/**
 * Quick fix — ensures Drey Idowu exists with the correct email.
 * Uses raw SQL only. Safe to run multiple times.
 *
 * Run: npx tsx scripts/fix-drey.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log('\n🔧 Drey Idowu fix\n');

  try {
    // Show current state
    const { rows: before } = await client.query(
      `SELECT name, email, role, is_active FROM users ORDER BY created_at`
    );
    console.log('Current users:');
    for (const u of before) {
      console.log(`  · ${u.name.padEnd(22)} ${u.email.padEnd(38)} [${u.role}] active=${u.is_active}`);
    }

    // Check if idowu.s@eti-trade.com already exists
    const { rows: existing } = await client.query(
      `SELECT id, name, email, is_active FROM users WHERE email = 'idowu.s@eti-trade.com'`
    );

    if (existing.length > 0) {
      const u = existing[0];
      if (!u.is_active) {
        // Reactivate if deactivated
        await client.query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`, [u.id]);
        console.log(`\n  ✅ Reactivated ${u.name} (idowu.s@eti-trade.com)`);
      } else {
        console.log(`\n  ✓ Drey Idowu (idowu.s@eti-trade.com) already exists and is active`);
      }
    } else {
      // Create Drey Idowu fresh
      const hash = await bcrypt.hash('etihub2024', 12);

      const { rows: [newUser] } = await client.query(
        `INSERT INTO users (id, email, name, role, title, password_hash, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'idowu.s@eti-trade.com', 'Drey Idowu', 'operations', 'Operations', $1, true, NOW(), NOW())
         RETURNING id`,
        [hash]
      );

      // Create notification preferences
      await client.query(
        `INSERT INTO notification_preferences (id, user_id, email_on_task_assigned, email_on_task_updated, email_on_message, email_on_announcement)
         VALUES (gen_random_uuid(), $1, true, true, false, true)
         ON CONFLICT DO NOTHING`,
        [newUser.id]
      );

      // Add to all group channels
      const { rows: channels } = await client.query(
        `SELECT id FROM channels WHERE type = 'group'`
      );
      for (const ch of channels) {
        await client.query(
          `INSERT INTO channel_members (id, channel_id, user_id, joined_at)
           VALUES (gen_random_uuid(), $1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [ch.id, newUser.id]
        );
      }

      console.log(`\n  ✅ Created Drey Idowu (idowu.s@eti-trade.com)`);
      console.log(`     Added to ${channels.length} group channels`);
    }

    // Clear sessions to force fresh login
    await client.query(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'idowu.s@eti-trade.com')`
    );

    // Final state
    console.log('\nFinal user list:');
    const { rows: after } = await client.query(
      `SELECT name, email, role FROM users WHERE is_active = true ORDER BY created_at`
    );
    for (const u of after) {
      console.log(`  · ${u.name.padEnd(22)} ${u.email.padEnd(38)} [${u.role}]`);
    }

    console.log('\n✅ Done!\n');
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
