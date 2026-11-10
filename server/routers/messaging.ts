import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const messagingRouter = router({
  // List channels the user is a member of
  listChannels: protectedProcedure.query(async ({ ctx }) => {
    const memberRows = await db
      .select({ channelId: schema.channelMembers.channelId })
      .from(schema.channelMembers)
      .where(eq(schema.channelMembers.userId, ctx.user!.id));
    const channelIds = memberRows.map((r) => r.channelId);

    if (channelIds.length === 0) return [];

    const rows = await db.query.channels.findMany({
      where: (c, { inArray }) => inArray(c.id, channelIds),
    });
    return rows;
  }),

  // Get or create a DM channel between current user and another user
  getOrCreateDM: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Check if a DM channel already exists between these two
      const existingMembers = await db
        .select({
          channelId: schema.channelMembers.channelId,
          userId: schema.channelMembers.userId,
        })
        .from(schema.channelMembers)
        .where(
          inArray(
            schema.channelMembers.userId,
            [ctx.user!.id, input.userId],
          ),
        );

      // Group by channelId and find one with exactly these two members
      const channelMap = new Map<string, Set<string>>();
      for (const m of existingMembers) {
        if (!channelMap.has(m.channelId)) channelMap.set(m.channelId, new Set());
        channelMap.get(m.channelId)!.add(m.userId);
      }

      for (const [channelId, members] of channelMap) {
        if (members.size === 2 && members.has(ctx.user!.id) && members.has(input.userId)) {
          const [ch] = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
          if (ch && ch.type === 'direct') return ch;
        }
      }

      // Create new DM channel
      const [otherUser] = await db.select().from(schema.users).where(eq(schema.users.id, input.userId)).limit(1);
      const [channel] = await db
        .insert(schema.channels)
        .values({
          name: `DM: ${ctx.user!.name} & ${otherUser?.name ?? 'Unknown'}`,
          type: 'direct',
          createdBy: ctx.user!.id,
        } as any)
        .returning();

      await db.insert(schema.channelMembers).values([
        { channelId: channel!.id, userId: ctx.user!.id },
        { channelId: channel!.id, userId: input.userId },
      ]);

      return channel!;
    }),

  // Create a group channel (admin only for now, could be expanded)
  createChannel: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        memberIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [channel] = await db
        .insert(schema.channels)
        .values({
          name: input.name,
          type: 'group',
          description: input.description,
          createdBy: ctx.user!.id,
        } as any)
        .returning();

      // Always add creator
      const members = new Set([ctx.user!.id, ...(input.memberIds ?? [])]);
      await db.insert(schema.channelMembers).values(
        Array.from(members).map((userId) => ({ channelId: channel!.id, userId })),
      );

      return channel!;
    }),

  // Get messages in a channel
  getMessages: protectedProcedure
    .input(z.object({ channelId: z.string().uuid(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const [member] = await db
        .select()
        .from(schema.channelMembers)
        .where(
          and(
            eq(schema.channelMembers.channelId, input.channelId),
            eq(schema.channelMembers.userId, ctx.user!.id),
          ),
        )
        .limit(1);

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      }

      const rows = await db.query.messages.findMany({
        where: (m, { eq }) => eq(m.channelId, input.channelId),
        with: { sender: true },
        orderBy: (m, { asc }) => [asc(m.createdAt)],
        limit: input.limit,
      });

      return rows;
    }),

  // Send a message
  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        content: z.string().min(1),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Verify membership
      const [member] = await db
        .select()
        .from(schema.channelMembers)
        .where(
          and(
            eq(schema.channelMembers.channelId, input.channelId),
            eq(schema.channelMembers.userId, ctx.user!.id),
          ),
        )
        .limit(1);

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      }

      const [message] = await db
        .insert(schema.messages)
        .values({
          channelId: input.channelId,
          senderId: ctx.user!.id,
          content: input.content,
          attachmentUrl: input.attachmentUrl ?? null,
          attachmentName: input.attachmentName ?? null,
        } as any)
        .returning();

      return message!;
    }),

  // Mark message as read
  markRead: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .insert(schema.messageReadReceipts)
        .values({ messageId: input.messageId, userId: ctx.user!.id })
        .onConflictDoNothing();
      return { success: true };
    }),
});
