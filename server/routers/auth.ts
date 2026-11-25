import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyOtherSessions,
  toSafeUser,
  MIN_PASSWORD_LENGTH,
} from '../_core/auth';
import { TRPCError } from '@trpc/server';
import { sendEmail } from '../email';

export const authRouter = router({
  // ── Login ─────────────────────────────────────────────────────────
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
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

      const ip = ctx.req?.ip ?? ctx.req?.socket?.remoteAddress ?? undefined;
      const ua = ctx.req?.headers['user-agent'] ?? undefined;
      const token = await createSession(user.id, { ipAddress: ip, userAgent: ua });

      // Audit log
      await db.insert(schema.auditLogs).values({
        userId: user.id,
        action: 'login',
        target: user.email,
        ipAddress: ip,
        details: { userAgent: ua },
      } as any).catch(() => {});

      ctx.res?.setHeader('Set-Cookie', buildCookie(token));
      return { user: toSafeUser(user), token };
    }),

  // ── Logout ────────────────────────────────────────────────────────
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req?.cookies?.['eti_hub_session'];
    if (token) {
      await destroySession(token);
      await db.insert(schema.auditLogs).values({
        userId: ctx.user.id,
        action: 'logout',
        target: ctx.user.email,
      } as any).catch(() => {});
    }
    ctx.res?.setHeader('Set-Cookie', buildCookie('', true));
    return { success: true };
  }),

  // ── Get current user ──────────────────────────────────────────────
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  // ── Change password ───────────────────────────────────────────────
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(MIN_PASSWORD_LENGTH),
    }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1);

      if (!user?.passwordHash) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });

      const newHash = await hashPassword(input.newPassword);
      await db.update(schema.users).set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      } as any).where(eq(schema.users.id, user.id));

      await db.insert(schema.auditLogs).values({
        userId: ctx.user.id,
        action: 'password_changed',
        target: ctx.user.email,
      } as any).catch(() => {});

      return { success: true };
    }),

  // ── Update profile ─────────────────────────────────────────────────
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      title: z.string().max(255).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(schema.users)
        .set({ ...input, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, ctx.user.id))
        .returning();
      return toSafeUser(updated!);
    }),

  // ── Forgot password ────────────────────────────────────────────────
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email.toLowerCase()))
        .limit(1);

      // Always return success to prevent email enumeration
      if (!user || !user.isActive) return { success: true };

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(schema.passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      } as any);

      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your ETI Hub password',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #0f2d5c;">ETI Hub — Password Reset</h2>
            <p>Hi ${user.name},</p>
            <p>You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}"
                 style="background:#0f2d5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Reset Password
              </a>
            </p>
            <p style="color: #64748b; font-size: 13px;">If you did not request this, ignore this email. Your password will not change.</p>
          </div>
        `,
      });

      return { success: true };
    }),

  // ── Reset password (from token) ────────────────────────────────────
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(MIN_PASSWORD_LENGTH),
    }))
    .mutation(async ({ input }) => {
      const [resetToken] = await db
        .select()
        .from(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, input.token))
        .limit(1);

      if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This reset link is invalid or has expired.' });
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(schema.users).set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      } as any).where(eq(schema.users.id, resetToken.userId));

      // Mark token as used
      await db.update(schema.passwordResetTokens)
        .set({ usedAt: new Date() } as any)
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      return { success: true };
    }),

  // ── Session management ─────────────────────────────────────────────
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const currentToken = ctx.req?.cookies?.['eti_hub_session'];
    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, ctx.user.id));

    return sessions.map((s) => ({
      id: s.id,
      isCurrent: s.token === currentToken,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: (s as any).lastActiveAt?.toISOString() ?? s.createdAt.toISOString(),
    }));
  }),

  revokeOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req?.cookies?.['eti_hub_session'];
    if (token) {
      await destroyOtherSessions(ctx.user.id, token);
      await db.insert(schema.auditLogs).values({
        userId: ctx.user.id,
        action: 'revoke_other_sessions',
        target: ctx.user.email,
      } as any).catch(() => {});
    }
    return { success: true };
  }),
});

function buildCookie(token: string, expired = false): string {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = expired ? 0 : 30 * 24 * 60 * 60 * 1000;
  return `eti_hub_session=${token}; Path=/; HttpOnly; SameSite=${isProd ? 'None' : 'Lax'};${isProd ? ' Secure;' : ''} Max-Age=${Math.floor(maxAge / 1000)}`;
}
