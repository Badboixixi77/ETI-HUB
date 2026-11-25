/**
 * ETI Hub — Add New User Script
 * Uses raw SQL only. Safe to run multiple times (idempotent).
 *
 * Run: npx tsx scripts/add-user.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// ── New users to add ──────────────────────────────────────────────────
const NEW_USERS = [
  {
    email: 'omotoso.j@eti-trade.com',
    name: 'Omotoso Jesupemi',
    role: 'support',
    title: 'ETI Market',
    password: 'etihub2024',
  },
];

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log('\n👤 ETI Hub — Add New Users\n');

  try {
    for (const user of NEW_USERS) {
      // Check if already exists
      const { rows: existing } = await client.query(
        `SELECT id, name, email FROM users WHERE email = $1`,
        [user.email]
      );

      if (existing.length > 0) {
        console.log(`  ✓ ${user.name} (${user.email}) — already exists, skipping`);
        continue;
      }

      // Hash password
      const hash = await bcrypt.hash(user.password, 12);

      // Insert user
      const { rows: [newUser] } = await client.query(
        `INSERT INTO users (id, email, name, role, title, password_hash, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
         RETURNING id, name, email, role`,
        [user.email, user.name, user.role, user.title, hash]
      );

      console.log(`  ✅ Created ${newUser.name} (${newUser.email}) — role: ${newUser.role}`);

      // Create notification preferences
      await client.query(
        `INSERT INTO notification_preferences (id, user_id, email_on_task_assigned, email_on_task_updated, email_on_message, email_on_announcement)
         VALUES (gen_random_uuid(), $1, true, true, false, true)`,
        [newUser.id]
      );

      // Add to all group channels
      const { rows: channels } = await client.query(
        `SELECT id, name FROM channels WHERE type = 'group'`
      );

      for (const ch of channels) {
        await client.query(
          `INSERT INTO channel_members (id, channel_id, user_id, joined_at)
           VALUES (gen_random_uuid(), $1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [ch.id, newUser.id]
        );
      }

      console.log(`     Added to ${channels.length} channels: ${channels.map((c: any) => '#' + c.name).join(', ')}`);
    }

    // Final state
    console.log('\nAll active users:');
    const { rows: all } = await client.query(
      `SELECT name, email, role, title FROM users WHERE is_active = true ORDER BY created_at`
    );
    for (const u of all) {
      console.log(`  · ${u.name.padEnd(22)} ${u.email.padEnd(38)} [${u.role}]${u.title ? ' — ' + u.title : ''}`);
    }

    console.log('\n✅ Done!\n');
    console.log('Login credentials:');
    for (const u of NEW_USERS) {
      console.log(`  ${u.name}: ${u.email} / ${u.password}`);
    }

  } finally {
    client.release();
    await pool.end();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
