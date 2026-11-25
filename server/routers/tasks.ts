import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema, insertAuditLog } from '../db';
import { eq, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createNotification } from './notifications';
import { sendTaskAssignedEmail, sendTaskUpdatedEmail } from '../email';

export const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      assignedTo: z.string().uuid().optional(),
      createdBy: z.string().uuid().optional(),
      status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      mine: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return db.query.tasks.findMany({
        with: {
          assignee: true,
          creator: true,
          comments: { with: { user: true }, orderBy: (c, { asc }) => [asc(c.createdAt)] },
        },
        where: (task, { eq, and }) => {
          const conditions: any[] = [];
          if (input?.mine) {
            conditions.push(or(eq(task.assignedTo, ctx.user!.id), eq(task.createdBy, ctx.user!.id))!);
          } else {
            if (input?.assignedTo) conditions.push(eq(task.assignedTo, input.assignedTo));
            if (input?.createdBy) conditions.push(eq(task.createdBy, input.createdBy));
          }
          if (input?.status) conditions.push(eq(task.status, input.status));
          if (input?.priority) conditions.push(eq(task.priority, input.priority));
          return and(...conditions);
        },
        orderBy: (task, { desc }) => [desc(task.createdAt)],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const task = await db.query.tasks.findFirst({
        with: {
          assignee: true,
          creator: true,
          comments: { with: { user: true }, orderBy: (c, { asc }) => [asc(c.createdAt)] },
        },
        where: (t, { eq }) => eq(t.id, input.id),
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      return task;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'blocked', 'done']).default('todo'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      assignedTo: z.string().uuid().nullable().optional(),
      dueDate: z.string().datetime().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [task] = await db.insert(schema.tasks).values({
        ...input,
        assignedTo: input.assignedTo ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdBy: ctx.user!.id,
      } as any).returning();

      if (task && input.assignedTo && input.assignedTo !== ctx.user!.id) {
        await createNotification({
          userId: input.assignedTo,
          type: 'task_assigned',
          title: 'New task assigned to you',
          body: task.title,
          link: `/tasks/${task.id}`,
        });

        // Send email if preference enabled
        const [assignee] = await db.select().from(schema.users).where(eq(schema.users.id, input.assignedTo)).limit(1);
        const [prefs] = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, input.assignedTo)).limit(1);
        if (assignee && prefs?.emailOnTaskAssigned) {
          sendTaskAssignedEmail({
            to: assignee.email,
            recipientName: assignee.name,
            taskTitle: task.title,
            assignedByName: ctx.user!.name,
            taskUrl: `${process.env.CLIENT_URL}/tasks/${task.id}`,
          }).catch(() => {});
        }
      }

      return task!;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assignedTo: z.string().uuid().nullable().optional(),
      dueDate: z.string().datetime().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const existing = await db.query.tasks.findFirst({ where: (t, { eq }) => eq(t.id, id) });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const [updated] = await db.update(schema.tasks).set({
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : existing.dueDate,
        updatedAt: new Date(),
      } as any).where(eq(schema.tasks.id, id)).returning();

      // Notify & email new assignee
      if (data.assignedTo && data.assignedTo !== existing.assignedTo && data.assignedTo !== ctx.user!.id) {
        await createNotification({
          userId: data.assignedTo,
          type: 'task_assigned',
          title: 'New task assigned to you',
          body: updated!.title,
          link: `/tasks/${id}`,
        });
        const [assignee] = await db.select().from(schema.users).where(eq(schema.users.id, data.assignedTo)).limit(1);
        const [prefs] = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, data.assignedTo)).limit(1);
        if (assignee && prefs?.emailOnTaskAssigned) {
          sendTaskAssignedEmail({
            to: assignee.email,
            recipientName: assignee.name,
            taskTitle: updated!.title,
            assignedByName: ctx.user!.name,
            taskUrl: `${process.env.CLIENT_URL}/tasks/${id}`,
          }).catch(() => {});
        }
      }

      // Notify & email old assignee on status change
      if (data.status && data.status !== existing.status && existing.assignedTo && existing.assignedTo !== ctx.user!.id) {
        const statusLabel = data.status.replace('_', ' ');
        await createNotification({
          userId: existing.assignedTo,
          type: 'task_updated',
          title: 'Task status updated',
          body: `${updated!.title} → ${statusLabel}`,
          link: `/tasks/${id}`,
        });
        const [assignee] = await db.select().from(schema.users).where(eq(schema.users.id, existing.assignedTo)).limit(1);
        const [prefs] = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, existing.assignedTo)).limit(1);
        if (assignee && prefs?.emailOnTaskUpdated) {
          sendTaskUpdatedEmail({
            to: assignee.email,
            recipientName: assignee.name,
            taskTitle: updated!.title,
            updateDescription: `Status changed to: ${statusLabel}`,
            taskUrl: `${process.env.CLIENT_URL}/tasks/${id}`,
          }).catch(() => {});
        }
      }

      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.tasks.findFirst({ where: (t, { eq }) => eq(t.id, input.id) });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      if (existing.createdBy !== ctx.user!.id && ctx.user!.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the task creator or an admin can delete this task' });
      }
      await insertAuditLog({
        userId: ctx.user!.id,
        userEmail: ctx.user!.email,
        action: 'task_delete',
        targetType: 'task',
        targetId: input.id,
        target: existing.title,
        details: { taskId: input.id },
      });
      await db.delete(schema.tasks).where(eq(schema.tasks.id, input.id));
      return { success: true };
    }),

  addComment: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const [comment] = await db.insert(schema.taskComments)
        .values({ ...input, userId: ctx.user!.id } as any)
        .returning();
      return comment!;
    }),

  stats: protectedProcedure.query(async () => {
    const [total, todo, inProgress, blocked, done] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks).where(eq(schema.tasks.status, 'todo')),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks).where(eq(schema.tasks.status, 'in_progress')),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks).where(eq(schema.tasks.status, 'blocked')),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.tasks).where(eq(schema.tasks.status, 'done')),
    ]);
    return {
      total: total[0]?.count ?? 0,
      todo: todo[0]?.count ?? 0,
      inProgress: inProgress[0]?.count ?? 0,
      blocked: blocked[0]?.count ?? 0,
      done: done[0]?.count ?? 0,
    };
  }),
});
