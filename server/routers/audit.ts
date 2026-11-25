import { z } from 'zod';
import { router, roleProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, sql, desc } from 'drizzle-orm';

export const auditRouter = router({
  list: roleProcedure('admin')
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(50),
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;

      const rows = await db.query.auditLogs.findMany({
        with: { user: true },
        where: (log, { eq, and }) => {
          const conditions: any[] = [];
          if (input.userId) conditions.push(eq(log.userId, input.userId));
          if (input.action) conditions.push(eq(log.action, input.action));
          return and(...conditions);
        },
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        limit: input.limit,
        offset,
      });

      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.auditLogs);

      return {
        rows: rows.map((r) => ({
          id: r.id,
          action: r.action,
          target: r.target,
          details: r.details,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt.toISOString(),
          user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
        })),
        total: countRow?.count ?? 0,
        page: input.page,
        pages: Math.ceil((countRow?.count ?? 0) / input.limit),
      };
    }),
});
