import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { KanbanColumn } from '../../shared/types';

export const boardRouter = router({
  // List all board items
  list: protectedProcedure.query(async () => {
    const rows = await db.query.boardItems.findMany({
      with: { assignee: true },
      orderBy: (b, { asc }) => [asc(b.createdAt)],
    });
    return rows;
  }),

  // Create a board item
  create: protectedProcedure
    .input(
      z.object({
        orderRef: z.string().min(1).max(100),
        buyer: z.string().min(1).max(255),
        seller: z.string().min(1).max(255),
        amount: z.number().int().nullable().optional(),
        currency: z.string().max(10).default('GBP'),
        column: z.enum(['new_order', 'kyc_review', 'inspection', 'shipment', 'delivery', 'completed']).default('new_order'),
        assignedTo: z.string().uuid().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [item] = await db
        .insert(schema.boardItems)
        .values({
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        } as any)
        .returning();
      return item!;
    }),

  // Move a card to a different column (drag and drop)
  move: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        column: z.enum(['new_order', 'kyc_review', 'inspection', 'shipment', 'delivery', 'completed']),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(schema.boardItems)
        .set({ column: input.column as KanbanColumn, updatedAt: new Date() } as any)
        .where(eq(schema.boardItems.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Board item not found' });
      return updated;
    }),

  // Update a board item
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        orderRef: z.string().min(1).max(100).optional(),
        buyer: z.string().min(1).max(255).optional(),
        seller: z.string().min(1).max(255).optional(),
        amount: z.number().int().nullable().optional(),
        currency: z.string().max(10).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(schema.boardItems)
        .set({
          ...data,
          dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
          updatedAt: new Date(),
        } as any)
        .where(eq(schema.boardItems.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Board item not found' });
      return updated;
    }),

  // Delete a board item
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(schema.boardItems).where(eq(schema.boardItems.id, input.id));
      return { success: true };
    }),

  // Dashboard stat
  count: protectedProcedure.query(async () => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.boardItems).where(
      sql`${schema.boardItems.column} != 'completed'`,
    );
    return row?.count ?? 0;
  }),
});
