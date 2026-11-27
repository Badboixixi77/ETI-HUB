/**
 * ETI Hub — Clear Seed / Placeholder Data
 *
 * Removes all sample data created by the seed script:
 * - All board items (operations cards)
 * - All tasks
 * - All calendar events
 * - All task comments
 * - All notifications
 * - Keeps: users, channels, announcements, documents
 *
 * Run: npx tsx scripts/clear-seed-data.ts
 * Safe to run multiple times.
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log('\n🧹 ETI Hub — Clearing placeholder data\n');

  try {
    // Show what we're about to delete
    const { rows: boardItems } = await client.query('SELECT COUNT(*) as n FROM board_items');
    const { rows: tasks } = await client.query('SELECT COUNT(*) as n FROM tasks');
    const { rows: events } = await client.query('SELECT COUNT(*) as n FROM events');
    const { rows: notifications } = await client.query('SELECT COUNT(*) as n FROM notifications');

    console.log('Current counts:');
    console.log(`  Board items:   ${boardItems[0].n}`);
    console.log(`  Tasks:         ${tasks[0].n}`);
    console.log(`  Events:        ${events[0].n}`);
    console.log(`  Notifications: ${notifications[0].n}`);
    console.log('');

    // Delete in dependency order
    const steps = [
      { label: 'task comments',  sql: 'DELETE FROM task_comments' },
      { label: 'tasks',          sql: 'DELETE FROM tasks' },
      { label: 'board items',    sql: 'DELETE FROM board_items' },
      { label: 'calendar events',sql: 'DELETE FROM events' },
      { label: 'notifications',  sql: 'DELETE FROM notifications' },
      // Also clear read receipts for messages so the UI starts clean
      { label: 'message read receipts', sql: 'DELETE FROM message_read_receipts' },
    ];

    for (const step of steps) {
      const result = await client.query(step.sql);
      console.log(`  ✅ Deleted ${result.rowCount} ${step.label}`);
    }

    // Verify
    console.log('\nFinal counts:');
    const { rows: finalBoard } = await client.query('SELECT COUNT(*) as n FROM board_items');
    const { rows: finalTasks } = await client.query('SELECT COUNT(*) as n FROM tasks');
    const { rows: finalEvents } = await client.query('SELECT COUNT(*) as n FROM events');
    console.log(`  Board items:   ${finalBoard[0].n}`);
    console.log(`  Tasks:         ${finalTasks[0].n}`);
    console.log(`  Events:        ${finalEvents[0].n}`);

    console.log('\n✅ Done — platform is clean and ready for real data.\n');

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
