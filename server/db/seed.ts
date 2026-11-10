import 'dotenv/config';
import { db, schema } from '../db';
import { hashPassword } from '../_core/auth';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding ETI Hub database...');

  // ── Team members ─────────────────────────────────────────────────
  const teamMembers = [
    { name: 'Taofeeq Adebayo', email: 'taofeeq@etiandpartners.com', role: 'admin', title: 'Director' },
    { name: 'Okosun Maxwell', email: 'maxwell@etiandpartners.com', role: 'admin', title: 'Lead Developer' },
    { name: 'Bushirah', email: 'bushirah@etiandpartners.com', role: 'finance', title: 'Finance' },
    { name: 'Drey', email: 'drey@etiandpartners.com', role: 'operations', title: 'Operations' },
    { name: 'Idowu', email: 'idowu@etiandpartners.com', role: 'operations', title: 'Operations' },
    { name: 'Zaynab', email: 'zaynab@etiandpartners.com', role: 'support', title: 'Onboarding / Support' },
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

    await db.insert(schema.notificationPreferences).values({ userId: user!.id });
    console.log(`  ✓ Created ${member.name} (${member.email})`);
  }

  // ── Default channels ─────────────────────────────────────────────
  const allUsers = await db.select().from(schema.users);
  const defaultChannels = [
    { name: 'general', description: 'General team chat', type: 'group' as const },
    { name: 'operations', description: 'Operations & logistics discussion', type: 'group' as const },
    { name: 'finance', description: 'Finance & payments', type: 'group' as const },
    { name: 'engineering', description: 'Engineering & development', type: 'group' as const },
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
        type: ch.type,
        createdBy: allUsers[0]?.id,
      } as any)
      .returning();

    // Add all users to default channels
    if (channel) {
      await db.insert(schema.channelMembers).values(
        allUsers.map((u) => ({ channelId: channel.id, userId: u.id })),
      );
      console.log(`  ✓ Created channel #${ch.name} with ${allUsers.length} members`);
    }
  }

  // ── Sample announcement ──────────────────────────────────────────
  const existingAnn = await db.select().from(schema.announcements).limit(1);
  if (existingAnn.length === 0 && allUsers.length > 0) {
    await db.insert(schema.announcements).values({
      title: 'Welcome to ETI Hub',
      body: 'ETI Hub is our new internal platform for team collaboration, task management, and operations tracking across the UK-Nigeria trade corridor. Please update your profile and explore the modules. Contact Taofeeq or Maxwell if you have any questions.',
      isPinned: true,
      createdBy: allUsers[0].id,
    } as any);
    console.log('  ✓ Created welcome announcement');
  }

  // ── Sample tasks ──────────────────────────────────────────────────
  const existingTasks = await db.select().from(schema.tasks).limit(1);
  if (existingTasks.length === 0 && allUsers.length > 0) {
    const taofeeq = allUsers.find((u) => u.email === 'taofeeq@etiandpartners.com');
    const maxwell = allUsers.find((u) => u.email === 'maxwell@etiandpartners.com');
    const bushirah = allUsers.find((u) => u.email === 'bushirah@etiandpartners.com');
    const drey = allUsers.find((u) => u.email === 'drey@etiandpartners.com');
    const zaynab = allUsers.find((u) => u.email === 'zaynab@etiandpartners.com');

    const sampleTasks = [
      { title: 'Review Q4 trade manifests', description: 'Cross-check all manifests from October shipments', priority: 'high' as const, assignedTo: drey?.id, createdBy: taofeeq?.id },
      { title: 'Process seller KYC batch #42', description: '12 sellers pending KYC verification', priority: 'urgent' as const, assignedTo: zaynab?.id, createdBy: taofeeq?.id },
      { title: 'Invoice reconciliation - October', description: 'Reconcile all October invoices with payments received', priority: 'medium' as const, assignedTo: bushirah?.id, createdBy: taofeeq?.id },
      { title: 'Set up WebSocket notifications', description: 'Real-time notification system for task updates and messages', priority: 'medium' as const, assignedTo: maxwell?.id, createdBy: maxwell?.id },
      { title: 'Update operations board layout', description: 'Add new column for customs clearance step', priority: 'low' as const, assignedTo: drey?.id, createdBy: taofeeq?.id },
    ];

    for (const task of sampleTasks) {
      const due = new Date();
      due.setDate(due.getDate() + Math.floor(Math.random() * 14) + 1);
      await db.insert(schema.tasks).values({
        ...task,
        assignedTo: task.assignedTo ?? null,
        createdBy: task.createdBy ?? allUsers[0].id,
        dueDate: due,
      } as any);
    }
    console.log(`  ✓ Created ${sampleTasks.length} sample tasks`);
  }

  // ── Sample board items ────────────────────────────────────────────
  const existingBoard = await db.select().from(schema.boardItems).limit(1);
  if (existingBoard.length === 0 && allUsers.length > 0) {
    const drey = allUsers.find((u) => u.email === 'drey@etiandpartners.com');
    const idowu = allUsers.find((u) => u.email === 'idowu@etiandpartners.com');
    const zaynab = allUsers.find((u) => u.email === 'zaynab@etiandpartners.com');

    const boardItems = [
      { orderRef: 'ETI-2024-001', buyer: 'Manchester Foods Ltd', seller: 'Lagos Agro Co', amount: 12500, column: 'kyc_review', assignedTo: zaynab?.id },
      { orderRef: 'ETI-2024-002', buyer: 'London Textiles PLC', seller: 'Abuja Fabrics', amount: 8500, column: 'inspection', assignedTo: drey?.id },
      { orderRef: 'ETI-2024-003', buyer: 'Birmingham Logistics', seller: 'Port Harcourt Trading', amount: 22000, column: 'shipment', assignedTo: idowu?.id },
      { orderRef: 'ETI-2024-004', buyer: 'Bristol Imports Ltd', seller: 'Kano Produce', amount: 5600, column: 'new_order', assignedTo: null },
      { orderRef: 'ETI-2024-005', buyer: 'Leeds Manufacturing', seller: 'Ibadan Goods', amount: 15300, column: 'delivery', assignedTo: drey?.id },
    ];

    for (const item of boardItems) {
      const due = new Date();
      due.setDate(due.getDate() + Math.floor(Math.random() * 21) + 3);
      await db.insert(schema.boardItems).values({
        ...item,
        assignedTo: item.assignedTo ?? null,
        dueDate: due,
      } as any);
    }
    console.log(`  ✓ Created ${boardItems.length} board items`);
  }

  // ── Sample calendar events ────────────────────────────────────────
  const existingEvents = await db.select().from(schema.events).limit(1);
  if (existingEvents.length === 0 && allUsers.length > 0) {
    const taofeeq = allUsers.find((u) => u.email === 'taofeeq@etiandpartners.com');

    const now = new Date();
    const events = [
      { title: 'Weekly ops review meeting', category: 'meeting' as const, startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 10, 0), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 11, 0), allDay: false, location: 'Zoom' },
      { title: 'Shipment ETI-2024-003 arrives London', category: 'shipment' as const, startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5), allDay: true, location: 'Port of London' },
      { title: 'Q4 budget submission deadline', category: 'deadline' as const, startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14), allDay: true },
      { title: 'Factory inspection - Lagos', category: 'inspection' as const, startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 8, 0), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 16, 0), location: 'Lagos, Nigeria' },
    ];

    for (const event of events) {
      await db.insert(schema.events).values({
        ...event,
        createdBy: taofeeq?.id ?? allUsers[0].id,
      } as any);
    }
    console.log(`  ✓ Created ${events.length} calendar events`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\nLogin credentials:');
  console.log('  Email: taofeeq@etiandpartners.com');
  console.log('  Password: etihub2024');
  console.log('\nAll team members use the same password: etihub2024');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
