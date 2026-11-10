import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Role } from '../../shared/types';
import { hasRole } from '../_core/auth';

const s3 = new S3Client({
  region: process.env.S3_REGION || 'eu-west-2',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

const BUCKET = process.env.S3_BUCKET || 'eti-hub-documents';

// Map document categories to roles that can access them
const CATEGORY_ROLE_ACCESS: Record<string, Role[]> = {
  invoice: ['admin', 'finance'],
  compliance: ['admin', 'operations'],
  contract: ['admin', 'operations', 'finance'],
  meeting_notes: ['admin', 'operations', 'finance', 'support', 'developer'],
  other: ['admin', 'operations', 'finance', 'support', 'developer'],
};

export const documentsRouter = router({
  // List documents (filtered by user role)
  list: protectedProcedure
    .input(
      z.object({
        category: z.enum(['contract', 'invoice', 'compliance', 'meeting_notes', 'other']).optional(),
      }).optional(),
    )
    .query(async ({ input, ctx }) => {
      // Filter documents the user can access based on role
      const accessibleCategories = (Object.keys(CATEGORY_ROLE_ACCESS) as string[]).filter((cat) =>
        hasRole(ctx.user!.role, CATEGORY_ROLE_ACCESS[cat]),
      );

      const rows = await db.query.documents.findMany({
        where: (d, { eq, and, inArray }) => {
          const conditions = [inArray(d.category, accessibleCategories as any[])];
          if (input?.category) conditions.push(eq(d.category, input.category));
          return and(...conditions);
        },
        with: { uploadedBy: true },
        orderBy: (d, { desc }) => [desc(d.createdAt)],
      });
      return rows;
    }),

  // Get a single document with version history
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const doc = await db.query.documents.findFirst({
        where: (d, { eq }) => eq(d.id, input.id),
        with: {
          uploadedBy: true,
          versions: { with: { uploadedBy: true }, orderBy: (v, { desc }) => [desc(v.version)] },
        },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      if (!hasRole(ctx.user!.role, CATEGORY_ROLE_ACCESS[doc.category] ?? [])) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this document' });
      }

      return doc;
    }),

  // Get a presigned upload URL for S3
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = `uploads/${ctx.user!.id}/${Date.now()}-${input.fileName}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      return { uploadUrl, key };
    }),

  // Create a document record (after upload to S3)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        category: z.enum(['contract', 'invoice', 'compliance', 'meeting_notes', 'other']),
        description: z.string().nullable().optional(),
        fileKey: z.string().min(1),
        fileSize: z.number().int().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [doc] = await db
        .insert(schema.documents)
        .values({
          name: input.name,
          category: input.category,
          description: input.description ?? null,
          uploadedBy: ctx.user!.id,
        } as any)
        .returning();

      await db.insert(schema.documentVersions).values({
        documentId: doc!.id,
        version: 1,
        fileKey: input.fileKey,
        fileSize: input.fileSize ?? null,
        uploadedBy: ctx.user!.id,
      } as any);

      return doc!;
    }),

  // Upload a new version of an existing document
  addVersion: protectedProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        fileKey: z.string().min(1),
        fileSize: z.number().int().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Get current max version
      const versions = await db
        .select()
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.documentId, input.documentId));

      const maxVersion = Math.max(0, ...versions.map((v) => v.version));

      const [version] = await db
        .insert(schema.documentVersions)
        .values({
          documentId: input.documentId,
          version: maxVersion + 1,
          fileKey: input.fileKey,
          fileSize: input.fileSize ?? null,
          uploadedBy: ctx.user!.id,
        } as any)
        .returning();

      await db
        .update(schema.documents)
        .set({ updatedAt: new Date() } as any)
        .where(eq(schema.documents.id, input.documentId));

      return version!;
    }),

  // Delete a document (admin only)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user!.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can delete documents' });
      }
      await db.delete(schema.documents).where(eq(schema.documents.id, input.id));
      return { success: true };
    }),
});
