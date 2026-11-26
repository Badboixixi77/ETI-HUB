import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { sql, eq } from 'drizzle-orm';

export const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input, ctx }) => {
      const q = `%${input.q.toLowerCase()}%`;

      const [taskRows, boardRows, docRows] = await Promise.all([
        db.select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status })
          .from(schema.tasks)
          .where(sql`lower(${schema.tasks.title}) LIKE ${q}`)
          .limit(5),

        db.select({ id: schema.boardItems.id, orderRef: schema.boardItems.orderRef, buyer: schema.boardItems.buyer, seller: schema.boardItems.seller, column: schema.boardItems.column })
          .from(schema.boardItems)
          .where(sql`lower(${schema.boardItems.orderRef}) LIKE ${q} OR lower(${schema.boardItems.buyer}) LIKE ${q} OR lower(${schema.boardItems.seller}) LIKE ${q}`)
          .limit(5),

        // Role-filtered documents
        db.select({ id: schema.documents.id, name: schema.documents.name, category: schema.documents.category })
          .from(schema.documents)
          .where(sql`lower(${schema.documents.name}) LIKE ${q}`)
          .limit(5),
      ]);

      return {
        tasks: taskRows.map((r) => ({ ...r, type: 'task' as const, url: `/tasks/${r.id}`, label: r.title, sub: r.status.replace('_', ' ') })),
        board: boardRows.map((r) => ({ ...r, type: 'board' as const, url: `/board`, label: r.orderRef, sub: `${r.buyer} → ${r.seller}` })),
        documents: docRows.map((r) => ({ ...r, type: 'document' as const, url: `/documents`, label: r.name, sub: r.category.replace('_', ' ') })),
      };
    }),
});
