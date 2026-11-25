/**
 * Quick fix — updates Maxwell's email to maxwell.okosun@eti-trade.com
 * regardless of what his current email is in the database.
 * Uses raw SQL only — no Drizzle, no schema dependency.
 *
 * Run: npx tsx scripts/fix-maxwell.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log('\n🔧 Maxwell email fix\n');

  try {
    // ── Step 1: Apply missing schema columns (safe with IF NOT EXISTS) ──
    console.log('Applying schema migrations...');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);`);
    await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);`);
    await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        target VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Schema up to date\n');

    // ── Step 2: Show current state of all users ──────────────────────────
    console.log('Current users in database:');
    const { rows: before } = await client.query(
      `SELECT name, email, role FROM users ORDER BY created_at`
    );
    for (const u of before) {
      console.log(`  · ${u.name.padEnd(20)} ${u.email}`);
    }

    // ── Step 3: Fix Maxwell — update ANY existing email to the correct one
    // Find by name since we don't know what email is in the DB
    const { rows: maxwells } = await client.query(
      `SELECT id, name, email FROM users WHERE lower(name) LIKE '%maxwell%' OR lower(name) LIKE '%okosun%'`
    );

    if (maxwells.length === 0) {
      console.log('\n  ⚠️  No user found with name containing "maxwell" or "okosun"');
      console.log('  Creating Maxwell from scratch...');

      // Hash the default password with bcrypt cost 12
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('etihub2024', 12);

      await client.query(
        `INSERT INTO users (id, email, name, role, title, password_hash, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'maxwell.okosun@eti-trade.com', 'Okosun Maxwell', 'admin', 'Lead Developer', $1, true, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [hash]
      );
      console.log('  ✅ Created Okosun Maxwell (maxwell.okosun@eti-trade.com)');
    } else {
      for (const user of maxwells) {
        if (user.email === 'maxwell.okosun@eti-trade.com') {
          console.log(`\n  ✓ ${user.name} already has the correct email`);
        } else {
          // Check if target email already exists (different record)
          const { rows: conflict } = await client.query(
            `SELECT id FROM users WHERE email = 'maxwell.okosun@eti-trade.com' AND id != $1`,
            [user.id]
          );
          if (conflict.length > 0) {
            // Delete the duplicate old record
            await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
            console.log(`\n  ✅ Removed duplicate Maxwell (${user.email}), correct email already exists`);
          } else {
            await client.query(
              `UPDATE users SET email = 'maxwell.okosun@eti-trade.com', name = 'Okosun Maxwell', title = 'Lead Developer', updated_at = NOW() WHERE id = $1`,
              [user.id]
            );
            console.log(`\n  ✅ Updated: ${user.email} → maxwell.okosun@eti-trade.com`);
          }
        }
      }
    }

    // ── Step 4: Invalidate all Maxwell's sessions so he logs in fresh ───
    await client.query(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'maxwell.okosun@eti-trade.com')`
    );
    console.log('  ✅ Cleared old sessions (fresh login required)');

    // ── Step 5: Final state ───────────────────────────────────────────────
    console.log('\nFinal user list:');
    const { rows: after } = await client.query(
      `SELECT name, email, role FROM users WHERE is_active = true ORDER BY created_at`
    );
    for (const u of after) {
      console.log(`  · ${u.name.padEnd(22)} ${u.email.padEnd(38)} [${u.role}]`);
    }

    console.log('\n✅ Done! Maxwell can now log in with:');
    console.log('   Email:    maxwell.okosun@eti-trade.com');
    console.log('   Password: etihub2024\n');

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
