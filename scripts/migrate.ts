/**
 * ETI Hub — Raw SQL Migration Script
 *
 * Applies all new columns and tables that drizzle-kit push fails to add
 * due to the primary key constraint bug. Safe to run multiple times.
 *
 * Run: npx tsx scripts/migrate.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  // ── users table ───────────────────────────────────────────────────
  {
    name: 'users.password_changed_at',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;`,
  },

  // ── sessions table ────────────────────────────────────────────────
  {
    name: 'sessions.user_agent',
    sql: `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);`,
  },
  {
    name: 'sessions.ip_address',
    sql: `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);`,
  },
  {
    name: 'sessions.last_active_at',
    sql: `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();`,
  },

  // ── messages table ────────────────────────────────────────────────
  {
    name: 'messages.attachment_type',
    sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);`,
  },

  // ── password_reset_tokens table ───────────────────────────────────
  {
    name: 'table.password_reset_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },

  // ── audit_logs table ──────────────────────────────────────────────
  {
    name: 'table.audit_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        target VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
];

async function run() {
  console.log('\n🔧 ETI Hub — SQL Migration\n');

  const client = await pool.connect();

  try {
    for (const m of migrations) {
      try {
        await client.query(m.sql);
        console.log(`  ✅ ${m.name}`);
      } catch (err: any) {
        // IF NOT EXISTS handles most idempotency, but log unexpected errors
        if (err.code === '42701') {
          // column already exists — fine
          console.log(`  ✓  ${m.name} (already exists)`);
        } else {
          console.error(`  ❌ ${m.name}: ${err.message}`);
          throw err;
        }
      }
    }
    console.log('\n✅ All migrations applied.\n');
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
