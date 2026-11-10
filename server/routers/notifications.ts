import { z } from 'zod';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';

// Internal helper to create a notification
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  await db.insert(schema.notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  } as any);
}

// Notification router (kept simple — could be expanded)
import { router, protectedProcedure } from '../_core/trpc';

export const notificationsRouter = router({
  // List notifications for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.user!.id))
      .orderBy(sql`${schema.notifications.createdAt} DESC`)
      .limit(50);
    return rows;
  }),

  // Unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.user!.id));
    return row?.count ?? 0;
  }),

  // Mark as read
  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(schema.notifications)
        .set({ isRead: true } as any)
        .where(eq(schema.notifications.id, input.id));
      return { success: true };
    }),

  // Mark all as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(schema.notifications)
      .set({ isRead: true } as any)
      .where(eq(schema.notifications.userId, ctx.user!.id));
    return { success: true };
  }),
});
