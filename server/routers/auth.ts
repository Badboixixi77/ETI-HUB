import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  toSafeUser,
  MIN_PASSWORD_LENGTH,
} from '../_core/auth';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  // Login with email + password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user || !user.passwordHash || !user.isActive) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const token = await createSession(user.id);
      ctx.res?.setHeader('Set-Cookie', buildCookie(token));

      return { user: toSafeUser(user), token };
    }),

  // Logout
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req?.cookies?.['eti_hub_session'];
    if (token) {
      await destroySession(token);
    }
    ctx.res?.setHeader('Set-Cookie', buildCookie('', true));
    return { success: true };
  }),

  // Get current user
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  // Change own password
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(MIN_PASSWORD_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }

      const newHash = await hashPassword(input.newPassword);
      await db
        .update(schema.users)
        .set({ passwordHash: newHash, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, user.id));

      return { success: true };
    }),

  // Update own profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        title: z.string().max(255).nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
        avatarUrl: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(schema.users)
        .set({ ...input, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, ctx.user.id))
        .returning();

      return toSafeUser(updated!);
    }),
});

function buildCookie(token: string, expired = false): string {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = expired ? 0 : 30 * 24 * 60 * 60 * 1000;
  return `eti_hub_session=${token}; Path=/; HttpOnly; SameSite=${
    isProd ? 'None' : 'Lax'
  };${isProd ? ' Secure;' : ''} Max-Age=${Math.floor(maxAge / 1000)}`;
}
