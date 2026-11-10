import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

export const settingsRouter = router({
  // Get current user's notification preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let [prefs] = await db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, ctx.user!.id))
      .limit(1);

    // Create default if none exists
    if (!prefs) {
      [prefs] = await db
        .insert(schema.notificationPreferences)
        .values({ userId: ctx.user!.id } as any)
        .returning();
    }

    return prefs;
  }),

  // Update notification preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        emailOnTaskAssigned: z.boolean().optional(),
        emailOnTaskUpdated: z.boolean().optional(),
        emailOnMessage: z.boolean().optional(),
        emailOnAnnouncement: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Ensure preferences exist
      const [existing] = await db
        .select()
        .from(schema.notificationPreferences)
        .where(eq(schema.notificationPreferences.userId, ctx.user!.id))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(schema.notificationPreferences)
          .set(input as any)
          .where(eq(schema.notificationPreferences.userId, ctx.user!.id))
          .returning();
        return updated!;
      } else {
        const [created] = await db
          .insert(schema.notificationPreferences)
          .values({ userId: ctx.user!.id, ...input } as any)
          .returning();
        return created!;
      }
    }),
});
