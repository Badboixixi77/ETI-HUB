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

// Procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Procedure that requires specific roles
export function roleProcedure(...roles: Role[]) {
  return t.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
    }
    if (!hasRole(ctx.user.role, roles)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this resource' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}
