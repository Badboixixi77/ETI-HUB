import { z } from 'zod';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';

// ── Internal helper: create an in-app notification + push via socket ──

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  // Write to DB
  await db.insert(schema.notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  } as any);

  // Push in real-time via Socket.IO (lazy import avoids circular dep)
  try {
    const { pushNotificationToUser } = await import('../index');
    pushNotificationToUser(params.userId, {
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    });
  } catch {
    // Socket push is best-effort — never break the main operation
  }
}

// ── Notification router ───────────────────────────────────────────────

import { router, protectedProcedure } from '../_core/trpc';

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.user!.id))
      .orderBy(sql`${schema.notifications.createdAt} DESC`)
      .limit(50);
    return rows;
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.user!.id));
    return row?.count ?? 0;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.notifications)
        .set({ isRead: true } as any)
        .where(eq(schema.notifications.id, input.id));
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(schema.notifications)
      .set({ isRead: true } as any)
      .where(eq(schema.notifications.userId, ctx.user!.id));
    return { success: true };
  }),
});
