import { initTRPC, TRPCError } from '@trpc/server';
import type { SafeUser, Role } from '../../shared/types';
import { hasRole } from './auth';
import type { Request, Response } from 'express';
import superjson from 'superjson';

export interface Context {
  user: SafeUser | null;
  req?: Request;
  res?: Response;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? undefined : error.cause,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ── Procedures that bypass password-change enforcement ────────────────
// These are always allowed even when passwordChangedAt is null.
// auth.me, auth.logout, auth.changePassword, auth.forgotPassword, auth.resetPassword
const PASSWORD_CHANGE_EXEMPT_PATHS = new Set([
  'auth.me',
  'auth.logout',
  'auth.changePassword',
  'auth.forgotPassword',
  'auth.resetPassword',
]);

// ── Password-change enforcement middleware ────────────────────────────
const enforcePasswordChanged = t.middleware(({ ctx, next, path }) => {
  if (!ctx.user) return next();

  // If the user has not changed their default password, only allow
  // the exempt procedures listed above.
  if (!ctx.user.passwordChangedAt && !PASSWORD_CHANGE_EXEMPT_PATHS.has(path)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'You must change your default password before continuing. Go to Settings → Profile.',
    });
  }

  return next();
});

// ── Procedure that requires authentication ─────────────────────────────
// Also enforces password-change requirement for non-exempt paths.
export const protectedProcedure = t.procedure
  .use(enforcePasswordChanged)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

// ── Procedure that requires specific roles ─────────────────────────────
export function roleProcedure(...roles: Role[]) {
  return t.procedure
    .use(enforcePasswordChanged)
    .use(({ ctx, next }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
      }
      if (!hasRole(ctx.user.role, roles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this resource' });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    });
}
