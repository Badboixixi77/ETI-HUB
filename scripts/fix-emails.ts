/**
 * ETI Hub — Email Migration + User Cleanup Script
 *
 * Updates all seeded user emails from @etiandpartners.com to @eti-trade.com,
 * merges the duplicate Idowu entry, and creates Faizat Adebayo if she doesn't exist.
 *
 * Run: npx tsx scripts/fix-emails.ts
 * Safe to run multiple times (idempotent).
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { db, schema } from '../server/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/_core/auth';

// ── Step 0: Apply raw SQL migrations before anything else ─────────────
async function applyMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const sqls = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;`,
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);`,
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);`,
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      target VARCHAR(255),
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  ];

  console.log('Step 0: Applying schema migrations...\n');
  for (const sql of sqls) {
    await client.query(sql);
  }
  console.log('  ✅ Schema up to date\n');

  client.release();
  await pool.end();
}

// ── Email mapping ─────────────────────────────────────────────────────
const EMAIL_UPDATES: Array<{
  oldEmail: string;
  newEmail: string;
  newName?: string;
  newTitle?: string;
}> = [
  {
    oldEmail: 'taofeeq@etiandpartners.com',
    newEmail: 'taofeeq.adebayo@eti-trade.com',
    newName: 'Taofeeq Adebayo',
    newTitle: 'Director',
  },
  {
    oldEmail: 'maxwell@etiandpartners.com',
    newEmail: 'maxwell.okosun@eti-trade.com',
    newName: 'Okosun Maxwell',
    newTitle: 'Lead Developer',
  },
  {
    // Handle the gmail address that was used in the seed
    oldEmail: 'okosun.maxwell4@gmail.com',
    newEmail: 'maxwell.okosun@eti-trade.com',
    newName: 'Okosun Maxwell',
    newTitle: 'Lead Developer',
  },
  {
    oldEmail: 'bushirah@etiandpartners.com',
    newEmail: 'adebayo.b@eti-trade.com',
    newName: 'Bushirah Adebayo',
    newTitle: 'Finance',
  },
  {
    oldEmail: 'drey@etiandpartners.com',
    newEmail: 'idowu.s@eti-trade.com',
    newName: 'Drey Idowu',
    newTitle: 'Operations',
  },
  {
    oldEmail: 'zaynab@etiandpartners.com',
    newEmail: 'zaynab.s@eti-trade.com',
    newName: 'Zaynab Sulaimon',
    newTitle: 'Onboarding / Support',
  },
];

// The old duplicate Idowu — will be merged/removed
const DUPLICATE_OLD_EMAIL = 'idowu@etiandpartners.com';

// New user to create
const NEW_USER = {
  email: 'adebayo.f@eti-trade.com',
  name: 'Faizat Adebayo',
  role: 'support' as const,
  title: 'Supplier Acquisition',
  password: 'etihub2024',
};

async function run() {
  console.log('\n🔧 ETI Hub — Email Migration Script\n');

  // ── 0. Apply schema migrations first ─────────────────────────────────
  await applyMigrations();

  // ── 1. Update existing emails ───────────────────────────────────────
  console.log('Step 1: Updating user emails...\n');

  for (const update of EMAIL_UPDATES) {
    // Check if the new email already exists
    const [already] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, update.newEmail))
      .limit(1);

    if (already) {
      console.log(`  ✓ ${update.newEmail} — already updated, skipping`);
      // Still update name/title if needed
      if (update.newName || update.newTitle) {
        await db
          .update(schema.users)
          .set({
            ...(update.newName ? { name: update.newName } : {}),
            ...(update.newTitle ? { title: update.newTitle } : {}),
            updatedAt: new Date(),
          } as any)
          .where(eq(schema.users.email, update.newEmail));
      }
      continue;
    }

    // Find by old email
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, update.oldEmail))
      .limit(1);

    if (!user) {
      console.log(`  ⚠️  ${update.oldEmail} — not found, skipping`);
      continue;
    }

    await db
      .update(schema.users)
      .set({
        email: update.newEmail,
        ...(update.newName ? { name: update.newName } : {}),
        ...(update.newTitle ? { title: update.newTitle } : {}),
        updatedAt: new Date(),
      } as any)
      .where(eq(schema.users.id, user.id));

    console.log(`  ✅ ${update.oldEmail} → ${update.newEmail} (${update.newName ?? user.name})`);
  }

  // ── 2. Handle duplicate Idowu ───────────────────────────────────────
  console.log('\nStep 2: Handling duplicate Idowu entry...\n');

  const [duplicateIdowu] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DUPLICATE_OLD_EMAIL))
    .limit(1);

  if (!duplicateIdowu) {
    console.log('  ✓ No duplicate found (already removed or never existed)');
  } else {
    // Reassign tasks from duplicate to the primary Idowu (idowu.s@eti-trade.com)
    const [primaryIdowu] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'idowu.s@eti-trade.com'))
      .limit(1);

    if (primaryIdowu) {
      // Migrate tasks assigned to duplicate → primary
      const tasksReassigned = await db
        .update(schema.tasks)
        .set({ assignedTo: primaryIdowu.id } as any)
        .where(eq(schema.tasks.assignedTo, duplicateIdowu.id));

      // Migrate board items
      await db
        .update(schema.boardItems)
        .set({ assignedTo: primaryIdowu.id } as any)
        .where(eq(schema.boardItems.assignedTo, duplicateIdowu.id));

      // Remove from channel memberships (avoid duplicate)
      const primaryMemberships = await db
        .select()
        .from(schema.channelMembers)
        .where(eq(schema.channelMembers.userId, primaryIdowu.id));

      const primaryChannelIds = new Set(primaryMemberships.map((m) => m.channelId));

      const duplicateMemberships = await db
        .select()
        .from(schema.channelMembers)
        .where(eq(schema.channelMembers.userId, duplicateIdowu.id));

      for (const m of duplicateMemberships) {
        if (!primaryChannelIds.has(m.channelId)) {
          // Add primary to this channel
          await db.insert(schema.channelMembers).values({
            channelId: m.channelId,
            userId: primaryIdowu.id,
          } as any);
        }
        // Delete duplicate membership
        await db
          .delete(schema.channelMembers)
          .where(eq(schema.channelMembers.id, m.id));
      }

      console.log(`  ✅ Migrated duplicate ${DUPLICATE_OLD_EMAIL} data to ${primaryIdowu.email}`);
    }

    // Delete the duplicate user (cascade will handle sessions, comments etc.)
    await db.delete(schema.users).where(eq(schema.users.id, duplicateIdowu.id));
    console.log(`  ✅ Deleted duplicate user ${DUPLICATE_OLD_EMAIL}`);
  }

  // ── 3. Create Faizat Adebayo ─────────────────────────────────────────
  console.log('\nStep 3: Creating Faizat Adebayo...\n');

  const [existingFaizat] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, NEW_USER.email))
    .limit(1);

  if (existingFaizat) {
    console.log(`  ✓ ${NEW_USER.email} — already exists, skipping`);
  } else {
    const passwordHash = await hashPassword(NEW_USER.password);
    const [faizat] = await db
      .insert(schema.users)
      .values({
        email: NEW_USER.email,
        name: NEW_USER.name,
        role: NEW_USER.role,
        title: NEW_USER.title,
        passwordHash,
      } as any)
      .returning();

    // Create notification preferences
    await db
      .insert(schema.notificationPreferences)
      .values({ userId: faizat!.id } as any);

    // Add to all group channels
    const groupChannels = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.type, 'group'));

    for (const ch of groupChannels) {
      await db
        .insert(schema.channelMembers)
        .values({ channelId: ch.id, userId: faizat!.id } as any)
        .onConflictDoNothing();
    }

    console.log(`  ✅ Created ${NEW_USER.name} (${NEW_USER.email}) with role: ${NEW_USER.role}`);
    console.log(`     Added to ${groupChannels.length} group channels`);
  }

  // ── 4. Final verification ─────────────────────────────────────────────
  console.log('\nStep 4: Final verification...\n');

  const allUsers = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.isActive, true))
    .orderBy(schema.users.createdAt);

  console.log('  Current active users:');
  for (const u of allUsers) {
    console.log(`  · ${u.name.padEnd(20)} ${u.email.padEnd(35)} [${u.role}]`);
  }

  console.log('\n✅ Migration complete!\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
