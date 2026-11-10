import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, sql, and, ne, desc } from 'drizzle-orm';

export const dashboardRouter = router({
  // Company-wide stats + personal data for the dashboard
  get: protectedProcedure.query(async ({ ctx }) => {
    // Company-wide stats
    const [
      activeOrders,
      pendingKyc,
      openShipments,
      unresolvedTickets,
      totalTasks,
      myTasks,
      recentActivity,
    ] = await Promise.all([
      // Active orders (board items not completed)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.boardItems)
        .where(ne(schema.boardItems.column, 'completed')),
      // Pending KYC reviews
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.boardItems)
        .where(eq(schema.boardItems.column, 'kyc_review')),
      // Open shipments
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.boardItems)
        .where(eq(schema.boardItems.column, 'shipment')),
      // Unresolved tickets (use blocked tasks as proxy for tickets)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .where(eq(schema.tasks.status, 'blocked')),
      // Total tasks
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks),
      // My assigned tasks
      db.query.tasks.findMany({
        where: (t, { eq }) => eq(t.assignedTo, ctx.user!.id),
        with: { assignee: true, creator: true },
        orderBy: (t, { asc }) => [asc(t.dueDate)],
        limit: 10,
      }),
      // Recent activity (recent tasks + announcements)
      db.query.tasks.findMany({
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        limit: 8,
      }),
    ]);

    return {
      stats: {
        activeOrders: activeOrders[0]?.count ?? 0,
        pendingKyc: pendingKyc[0]?.count ?? 0,
        openShipments: openShipments[0]?.count ?? 0,
        unresolvedTickets: unresolvedTickets[0]?.count ?? 0,
        totalTasks: totalTasks[0]?.count ?? 0,
      },
      myTasks,
      recentActivity: recentActivity.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      })),
      // Pinned announcements
      pinnedAnnouncements: await db.query.announcements.findMany({
        where: (a, { eq }) => eq(a.isPinned, true),
        with: { createdBy: true },
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        limit: 3,
      }).then((rows) => rows.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        createdBy: a.createdBy,
      }))),
    };
  }),
});
