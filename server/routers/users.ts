import { z } from 'zod';
import { router, protectedProcedure, roleProcedure } from '../_core/trpc';
import { db, schema, insertAuditLog } from '../db';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, toSafeUser } from '../_core/auth';
import { TRPCError } from '@trpc/server';
import type { Role } from '../../shared/types';

export const usersRouter = router({
  // List all team members (directory)
  list: protectedProcedure.query(async () => {
    const rows = await db.select().from(schema.users).orderBy(schema.users.name);
    return rows.map(toSafeUser);
  }),

  // Get a single user's profile
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, input.id))
        .limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      // Count active tasks as workload
      const [taskCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .where(
          sql`${schema.tasks.assignedTo} = ${input.id} AND ${schema.tasks.status} != 'done'`,
        );

      return { ...toSafeUser(user), activeTaskCount: taskCount?.count ?? 0 };
    }),

  // Invite a new team member (admin only)
  invite: roleProcedure('admin')
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(255),
        role: z.enum(['admin', 'finance', 'operations', 'support', 'developer']),
        title: z.string().max(255).optional(),
        phone: z.string().max(50).optional(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists' });
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await db
        .insert(schema.users)
        .values({
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role as any,
          title: input.title ?? null,
          phone: input.phone ?? null,
          passwordHash,
        } as any)
        .returning();

      // Create default notification preferences
      await db.insert(schema.notificationPreferences).values({ userId: user!.id });

      // Audit log
      await insertAuditLog({
        userId: ctx.user!.id,
        userEmail: ctx.user!.email,
        action: 'user_invite',
        targetType: 'user',
        targetId: user!.id,
        target: user!.email,
        details: { name: user!.name, role: user!.role },
      });

      return toSafeUser(user!);
    }),

  // Update a user's role / details (admin only)
  update: roleProcedure('admin')
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        role: z.enum(['admin', 'finance', 'operations', 'support', 'developer']).optional(),
        title: z.string().max(255).nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
        isActive: z.boolean().optional(),
        avatarUrl: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(schema.users)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      // Audit role changes
      if (data.role) {
        await insertAuditLog({
          userId: ctx.user!.id,
          userEmail: ctx.user!.email,
          action: 'role_change',
          targetType: 'user',
          targetId: updated.id,
          target: updated.email,
          details: { newRole: data.role },
        });
      }

      return toSafeUser(updated);
    }),

  // Deactivate a user (admin only)
  deactivate: roleProcedure('admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Fetch user before deactivation so we can audit with their details
      const [target] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, input.id))
        .limit(1);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      await db
        .update(schema.users)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, input.id));

      // Audit log
      await insertAuditLog({
        userId: ctx.user!.id,
        userEmail: ctx.user!.email,
        action: 'user_deactivate',
        targetType: 'user',
        targetId: target.id,
        target: target.email,
        details: { name: target.name, email: target.email, role: target.role },
      });

      return { success: true };
    }),
});
