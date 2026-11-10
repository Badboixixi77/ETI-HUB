import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, gte, lte, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const calendarRouter = router({
  // List events in a date range
  list: protectedProcedure
    .input(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(schema.events)
        .where(
          and(
            gte(schema.events.endDate, new Date(input.start)),
            lte(schema.events.startDate, new Date(input.end)),
          ),
        )
        .orderBy(schema.events.startDate);

      return rows.map((e) => ({
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
      }));
    }),

  // Get all events (no date filter, for simpler views)
  listAll: protectedProcedure.query(async () => {
    const rows = await db.select().from(schema.events).orderBy(schema.events.startDate);
    return rows.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
    }));
  }),

  // Create an event
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        category: z.enum(['deadline', 'shipment', 'inspection', 'meeting', 'other']).default('other'),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        allDay: z.boolean().default(false),
        location: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [event] = await db
        .insert(schema.events)
        .values({
          ...input,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          createdBy: ctx.user!.id,
        } as any)
        .returning();
      return { ...event!, startDate: event!.startDate.toISOString(), endDate: event!.endDate.toISOString() };
    }),

  // Update an event
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        category: z.enum(['deadline', 'shipment', 'inspection', 'meeting', 'other']).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        allDay: z.boolean().optional(),
        location: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);

      const [updated] = await db
        .update(schema.events)
        .set(updateData as any)
        .where(eq(schema.events.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      return { ...updated, startDate: updated.startDate.toISOString(), endDate: updated.endDate.toISOString() };
    }),

  // Delete an event
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [event] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, input.id))
        .limit(1);

      if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });

      if (event.createdBy !== ctx.user!.id && ctx.user!.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete events you created' });
      }

      await db.delete(schema.events).where(eq(schema.events.id, input.id));
      return { success: true };
    }),
});
