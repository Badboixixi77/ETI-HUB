import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', [
  'admin',
  'finance',
  'operations',
  'support',
  'developer',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'in_progress',
  'blocked',
  'done',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const kanbanColumnEnum = pgEnum('kanban_column', [
  'new_order',
  'kyc_review',
  'inspection',
  'shipment',
  'delivery',
  'completed',
]);

export const documentCategoryEnum = pgEnum('document_category', [
  'contract',
  'invoice',
  'compliance',
  'meeting_notes',
  'other',
]);

export const eventCategoryEnum = pgEnum('event_category', [
  'deadline',
  'shipment',
  'inspection',
  'meeting',
  'other',
]);

export const channelTypeEnum = pgEnum('channel_type', [
  'direct',
  'group',
]);

// ── Users & Sessions ────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('support'),
  title: varchar('title', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailOnTaskAssigned: boolean('email_on_task_assigned').notNull().default(true),
  emailOnTaskUpdated: boolean('email_on_task_updated').notNull().default(true),
  emailOnMessage: boolean('email_on_message').notNull().default(false),
  emailOnAnnouncement: boolean('email_on_announcement').notNull().default(true),
});

// ── Tasks ───────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Messaging ───────────────────────────────────────────────────────

export const channels = pgTable('channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: channelTypeEnum('type').notNull().default('group'),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const channelMembers = pgTable('channel_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  attachmentUrl: varchar('attachment_url', { length: 500 }),
  attachmentName: varchar('attachment_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messageReadReceipts = pgTable('message_read_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').defaultNow().notNull(),
});

// ── Operations Board (Kanban) ────────────────────────────────────────

export const boardItems = pgTable('board_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderRef: varchar('order_ref', { length: 100 }).notNull(),
  buyer: varchar('buyer', { length: 255 }).notNull(),
  seller: varchar('seller', { length: 255 }).notNull(),
  amount: integer('amount'),
  currency: varchar('currency', { length: 10 }).notNull().default('GBP'),
  column: kanbanColumnEnum('column').notNull().default('new_order'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Document Vault ──────────────────────────────────────────────────

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: documentCategoryEnum('category').notNull().default('other'),
  description: text('description'),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  allowedRoles: jsonb('allowed_roles'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documentVersions = pgTable('document_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  fileKey: varchar('file_key', { length: 500 }).notNull(),
  fileSize: integer('file_size'),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Calendar ────────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  category: eventCategoryEnum('category').notNull().default('other'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  allDay: boolean('all_day').notNull().default(false),
  location: varchar('location', { length: 255 }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Announcements ───────────────────────────────────────────────────

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body').notNull(),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const announcementReads = pgTable('announcement_reads', {
  id: uuid('id').defaultRandom().primaryKey(),
  announcementId: uuid('announcement_id')
    .notNull()
    .references(() => announcements.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').defaultNow().notNull(),
});

// ── Notifications ────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 500 }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Relations ────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  tasksAssigned: many(tasks, { relationName: 'assigned' }),
  tasksCreated: many(tasks, { relationName: 'created' }),
  taskComments: many(taskComments),
  sessions: many(sessions),
  channelMembers: many(channelMembers),
  messages: many(messages),
  boardItems: many(boardItems),
  documents: many(documents),
  documentVersions: many(documentVersions),
  events: many(events),
  announcements: many(announcements),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, { fields: [tasks.assignedTo], references: [users.id], relationName: 'assigned' }),
  creator: one(users, { fields: [tasks.createdBy], references: [users.id], relationName: 'created' }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one, many }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskComments.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  createdBy: one(users, { fields: [channels.createdBy], references: [users.id] }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.id] }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  readReceipts: many(messageReadReceipts),
}));

export const messageReadReceiptsRelations = relations(messageReadReceipts, ({ one }) => ({
  message: one(messages, { fields: [messageReadReceipts.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageReadReceipts.userId], references: [users.id] }),
}));

export const boardItemsRelations = relations(boardItems, ({ one }) => ({
  assignee: one(users, { fields: [boardItems.assignedTo], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  uploadedBy: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
  versions: many(documentVersions),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
  uploadedBy: one(users, { fields: [documentVersions.uploadedBy], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  createdBy: one(users, { fields: [events.createdBy], references: [users.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  createdBy: one(users, { fields: [announcements.createdBy], references: [users.id] }),
  reads: many(announcementReads),
}));

export const announcementReadsRelations = relations(announcementReads, ({ one }) => ({
  announcement: one(announcements, { fields: [announcementReads.announcementId], references: [announcements.id] }),
  user: one(users, { fields: [announcementReads.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
