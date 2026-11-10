import { z } from 'zod';
import { router, protectedProcedure, roleProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const announcementsRouter = router({
  // List announcements
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.announcements.findMany({
      with: { createdBy: true },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    // Attach read status for current user
    const reads = await db
      .select()
      .from(schema.announcementReads)
      .where(eq(schema.announcementReads.userId, ctx.user!.id));

    const readSet = new Set(reads.map((r) => r.announcementId));

    return rows.map((a) => ({
      ...a,
      isRead: readSet.has(a.id),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }),

  // Get pinned announcements (for dashboard)
  pinned: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.announcements.findMany({
      where: (a, { eq }) => eq(a.isPinned, true),
      with: { createdBy: true },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit: 3,
    });

    const reads = await db
      .select()
      .from(schema.announcementReads)
      .where(eq(schema.announcementReads.userId, ctx.user!.id));
    const readSet = new Set(reads.map((r) => r.announcementId));

    return rows.map((a) => ({
      ...a,
      isRead: readSet.has(a.id),
      createdAt: a.createdAt.toISOString(),
    }));
  }),

  // Create announcement (admin only)
  create: roleProcedure('admin')
    .input(
      z.object({
        title: z.string().min(1).max(500),
        body: z.string().min(1),
        isPinned: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [announcement] = await db
        .insert(schema.announcements)
        .values({
          ...input,
          createdBy: ctx.user!.id,
        } as any)
        .returning();

      // Create notifications for all active users
      const users = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.isActive, true));

      if (users.length > 0) {
        await db.insert(schema.notifications).values(
          users
            .filter((u) => u.id !== ctx.user!.id)
            .map((u) => ({
              userId: u.id,
              type: 'announcement',
              title: 'New announcement',
              body: input.title,
              link: '/announcements',
            })),
        );
      }

      return announcement!;
    }),

  // Update announcement (admin only)
  update: roleProcedure('admin')
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        body: z.string().min(1).optional(),
        isPinned: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(schema.announcements)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(schema.announcements.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      return updated;
    }),

  // Delete announcement (admin only)
  delete: roleProcedure('admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(schema.announcements).where(eq(schema.announcements.id, input.id));
      return { success: true };
    }),

  // Mark as read
  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .insert(schema.announcementReads)
        .values({ announcementId: input.id, userId: ctx.user!.id })
        .onConflictDoNothing();
      return { success: true };
    }),
});
