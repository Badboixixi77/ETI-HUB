import 'dotenv/config';
import { db, schema } from '../db';
import { hashPassword } from '../_core/auth';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding ETI Hub database...');

  // ── Team members ─────────────────────────────────────────────────
  const teamMembers = [
    { name: 'Taofeeq Adebayo', email: 'taofeeq.adebayo@eti-trade.com', role: 'admin', title: 'Director' },
    { name: 'Okosun Maxwell', email: 'maxwell.okosun@eti-trade.com', role: 'admin', title: 'Lead Developer' },
    { name: 'Bushirah Adebayo', email: 'adebayo.b@eti-trade.com', role: 'finance', title: 'Finance' },
    { name: 'Drey Idowu', email: 'idowu.s@eti-trade.com', role: 'operations', title: 'Operations' },
    { name: 'Zaynab Sulaimon', email: 'zaynab.s@eti-trade.com', role: 'support', title: 'Onboarding & Support' },
    { name: 'Faizat Adebayo', email: 'adebayo.f@eti-trade.com', role: 'support', title: 'Supplier Acquisition' },
    { name: 'Omotoso Jesupemi', email: 'omotoso.j@eti-trade.com', role: 'support', title: 'ETI Market' },
  ];

  for (const member of teamMembers) {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, member.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ ${member.name} already exists, skipping`);
      continue;
    }

    const passwordHash = await hashPassword('etihub2024');
    const [user] = await db
      .insert(schema.users)
      .values({
        name: member.name,
        email: member.email,
        role: member.role as any,
        title: member.title,
        passwordHash,
      } as any)
      .returning();

    await db.insert(schema.notificationPreferences).values({ userId: user!.id } as any);
    console.log(`  ✓ Created ${member.name} (${member.email})`);
  }

  const allUsers = await db.select().from(schema.users);

  // ── Default channels ─────────────────────────────────────────────
  const defaultChannels = [
    { name: 'general', description: 'General team chat' },
    { name: 'operations', description: 'Operations & logistics discussion' },
    { name: 'finance', description: 'Finance & payments' },
    { name: 'engineering', description: 'Engineering & development' },
  ];

  for (const ch of defaultChannels) {
    const existing = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.name, ch.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ Channel #${ch.name} already exists, skipping`);
      continue;
    }

    const [channel] = await db
      .insert(schema.channels)
      .values({
        name: ch.name,
        description: ch.description,
        type: 'group',
        createdBy: allUsers[0]?.id,
      } as any)
      .returning();

    if (channel) {
      await db.insert(schema.channelMembers).values(
        allUsers.map((u) => ({ channelId: channel.id, userId: u.id })),
      );
      console.log(`  ✓ Created channel #${ch.name} with ${allUsers.length} members`);
    }
  }

  // NOTE: No sample tasks, board items, or calendar events are created.
  // The platform starts clean — real data only.

  console.log('\n✅ Seed complete!');
  console.log('\nAll team members use the password: etihub2024');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
