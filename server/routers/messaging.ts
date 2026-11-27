import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { sendNewMessageEmail } from '../email';
import { createNotification } from './notifications';

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
        attachmentType: z.string().optional(),
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
          attachmentType: input.attachmentType ?? null,
        } as any)
        .returning();

      // For DM channels: notify + email the other member
      const [channel] = await db.select().from(schema.channels).where(eq(schema.channels.id, input.channelId)).limit(1);
      if (channel?.type === 'direct') {
        const members = await db.select({ userId: schema.channelMembers.userId })
          .from(schema.channelMembers)
          .where(eq(schema.channelMembers.channelId, input.channelId));
        const otherMemberId = members.find((m) => m.userId !== ctx.user!.id)?.userId;
        if (otherMemberId) {
          const [otherUser] = await db.select().from(schema.users).where(eq(schema.users.id, otherMemberId)).limit(1);
          const [prefs] = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, otherMemberId)).limit(1);

          if (otherUser) {
            // ── In-app notification + real-time socket push (always) ──
            await createNotification({
              userId: otherMemberId,
              type: 'new_message',
              title: `New message from ${ctx.user!.name}`,
              body: input.content.slice(0, 100),
              link: `/messages/${input.channelId}`,
            });

            // ── Email (only if preference enabled) ───────────────────
            if (prefs?.emailOnMessage) {
              sendNewMessageEmail({
                to: otherUser.email,
                recipientName: otherUser.name,
                senderName: ctx.user!.name,
                channelName: ctx.user!.name,
                preview: input.content.slice(0, 200),
                messagesUrl: `${process.env.CLIENT_URL}/messages/${input.channelId}`,
              }).catch(() => {});
            }
          }
        }
      }

      return message!;
    }),

  // Mark message as read
  markRead: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify the user is a member of the channel this message belongs to
      const [msg] = await db
        .select({ channelId: schema.messages.channelId })
        .from(schema.messages)
        .where(eq(schema.messages.id, input.messageId))
        .limit(1);

      if (!msg) return { success: true }; // message not found — silently ignore

      const [member] = await db
        .select()
        .from(schema.channelMembers)
        .where(
          and(
            eq(schema.channelMembers.channelId, msg.channelId),
            eq(schema.channelMembers.userId, ctx.user!.id),
          ),
        )
        .limit(1);

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      }

      await db
        .insert(schema.messageReadReceipts)
        .values({ messageId: input.messageId, userId: ctx.user!.id } as any)
        .onConflictDoNothing();
      return { success: true };
    }),

  // Get a presigned S3 URL for message file attachments
  getAttachmentUploadUrl: protectedProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      if (!process.env.AWS_ACCESS_KEY_ID) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'File storage is not configured' });
      }
      const s3 = new S3Client({
        region: process.env.S3_REGION || 'eu-west-2',
        credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
      });
      const key = `messages/${ctx.user!.id}/${Date.now()}-${input.fileName}`;
      const command = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: input.contentType });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      const fileUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'eu-west-2'}.amazonaws.com/${key}`;
      return { uploadUrl, key, fileUrl };
    }),
});
