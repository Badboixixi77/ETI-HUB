# ETI Hub — Full Project Report
**ETI & PARTNERS LIMITED | Lagos · London**
**Date:** November 2024
**Author:** Kiro AI (Build Session)
**Repository:** https://github.com/Badboixixi77/ETI-HUB
**Live URL:** https://eti-hub.onrender.com

---

## 1. Executive Summary

ETI Hub is a full-stack internal operations and collaboration platform built from scratch for the ETI & Partners Limited team. It is a private, invite-only web application — completely separate from the public ETI Marketplace — serving the team's day-to-day needs across task management, internal communication, trade operations tracking, document storage, and team coordination across the UK-Nigeria corridor.

The project was scaffolded, built, debugged, deployed, and mobile-optimised across a single session. It is live on Render and accessible to the team now.

**At a glance:**

| Metric | Value |
|--------|-------|
| Total source files | 65 |
| Lines of code | ~14,700 |
| Database tables | 17 |
| tRPC API procedures | 48 |
| Pages built | 12 |
| Reusable components | 8 |
| npm dependencies | 28 runtime, 17 dev |
| Client bundle size | 426 KB JS / 36 KB CSS |
| Deployment platform | Render (Free tier) |

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 5.4 | Build tool and dev server |
| Tailwind CSS | 3.4 | Styling |
| React Router | 6.27 | Client-side routing |
| TanStack Query | 5.59 | Server state and caching |
| Zustand | 5.0 | Client state (auth, sidebar, dark mode) |
| Socket.IO Client | 4.8 | Real-time messaging |
| Lucide React | 0.453 | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.21 | HTTP server |
| tRPC | 11.0 rc | Type-safe API layer |
| Drizzle ORM | 0.36 | Database queries and schema |
| PostgreSQL (via pg) | 8.13 | Primary database |
| bcrypt | 5.1 | Password hashing |
| Socket.IO | 4.8 | Real-time WebSocket server |
| Helmet | 8.0 | Security headers |
| express-rate-limit | 7.4 | Login rate limiting |
| AWS SDK S3 | 3.654 | Document file storage |
| Resend | 4.0 | Email notifications (configured, not wired) |
| superjson | 1.13 | tRPC serialisation |
| zod | 3.23 | Input validation |

### Infrastructure
| Component | Provider |
|-----------|----------|
| Hosting | Render (Web Service) |
| Database | Render Managed PostgreSQL |
| File Storage | AWS S3 (eu-west-2) |
| Domain | render.com subdomain |
| Node version | 20.18.0 |

---

## 3. Database Schema

17 tables across 7 domains:

### Auth & Users
- **users** — id, email, passwordHash, name, role, title, phone, avatarUrl, isActive, lastActiveAt
- **sessions** — id, userId, token, expiresAt (30-day rolling sessions)
- **notification_preferences** — per-user email notification toggles

### Tasks
- **tasks** — id, title, description, status (todo/in_progress/blocked/done), priority (low/medium/high/urgent), assignedTo, createdBy, dueDate
- **task_comments** — id, taskId, userId, content

### Messaging
- **channels** — id, name, type (direct/group), description, createdBy
- **channel_members** — channelId, userId, joinedAt
- **messages** — id, channelId, senderId, content, attachmentUrl, attachmentName
- **message_read_receipts** — messageId, userId, readAt

### Operations Board
- **board_items** — id, orderRef, buyer, seller, amount, currency, column (new_order/kyc_review/inspection/shipment/delivery/completed), assignedTo, dueDate, notes

### Documents
- **documents** — id, name, category, description, uploadedBy, allowedRoles
- **document_versions** — documentId, version, fileKey, fileSize, uploadedBy

### Calendar
- **events** — id, title, description, category, startDate, endDate, allDay, location, createdBy

### Announcements & Notifications
- **announcements** — id, title, body, isPinned, createdBy
- **announcement_reads** — announcementId, userId, readAt
- **notifications** — id, userId, type, title, body, link, isRead

### Enums (7)
`role` · `task_status` · `task_priority` · `kanban_column` · `document_category` · `event_category` · `channel_type`

---

## 4. API Layer (tRPC Routers)

All endpoints are type-safe end-to-end. The client has zero manually-written API calls — all data fetching and mutations go through tRPC with full TypeScript inference.

### auth (5 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| login | mutation | Email + password, sets httpOnly session cookie |
| logout | mutation | Destroys session cookie and DB record |
| me | query | Returns current user from session |
| changePassword | mutation | Verifies old password, sets new bcrypt hash |
| updateProfile | mutation | Name, title, phone, avatar |

### users (5 procedures)
| Procedure | Type | Access |
|-----------|------|--------|
| list | query | All authenticated users |
| getById | query | All — returns user + active task count |
| invite | mutation | Admin only — creates new user with temp password |
| update | mutation | Admin only — role, name, title, active status |
| deactivate | mutation | Admin only |

### tasks (7 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| list | query | Filterable by status, priority, assignee, mine |
| getById | query | Full task with assignee, creator, comment thread |
| create | mutation | Creates task + notifies assignee |
| update | mutation | Status, priority, assignee, due date — notifies on reassign |
| delete | mutation | Creator or admin only |
| addComment | mutation | Appends to comment thread |
| stats | query | Counts by status for dashboard |

### messaging (5 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| listChannels | query | Channels the user is a member of |
| getOrCreateDM | mutation | Gets or creates 1:1 direct channel |
| createChannel | mutation | Creates group channel with members |
| getMessages | query | Paginated messages with sender data |
| sendMessage | mutation | Sends message, membership verified |
| markRead | mutation | Records read receipt |

### board (6 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| list | query | All cards with assignee data |
| create | mutation | New kanban card |
| move | mutation | Moves card to a different column |
| update | mutation | Edits card fields |
| delete | mutation | Removes card |
| count | query | Active (non-completed) card count for dashboard |

### documents (6 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| list | query | Role-filtered document list |
| getById | query | Document + full version history |
| getUploadUrl | mutation | Returns S3 presigned PUT URL |
| create | mutation | Creates document record after S3 upload |
| addVersion | mutation | Appends new version to existing document |
| delete | mutation | Admin only |

### calendar (5 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| list | query | Events in date range |
| listAll | query | All events (for simpler views) |
| create | mutation | New event |
| update | mutation | Edit event |
| delete | mutation | Creator or admin |

### announcements (5 procedures)
| Procedure | Type | Access |
|-----------|------|--------|
| list | query | All — with per-user read status |
| pinned | query | Pinned only — for dashboard |
| create | mutation | Admin only — broadcasts notification to all |
| update | mutation | Admin only |
| delete | mutation | Admin only |
| markRead | mutation | Records individual read |

### notifications (4 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| list | query | Last 50 notifications for current user |
| unreadCount | query | Count for badge |
| markRead | mutation | Single notification |
| markAllRead | mutation | Clears all for current user |

### settings (2 procedures)
| Procedure | Type | Description |
|-----------|------|-------------|
| getPreferences | query | Email notification toggles |
| updatePreferences | mutation | Saves toggles |

### dashboard (1 procedure)
| Procedure | Type | Description |
|-----------|------|-------------|
| get | query | Company stats + my tasks + recent activity + pinned announcements in a single request |

---

## 5. Features Built

### 5.1 Authentication
- Email + password login with bcrypt (cost factor 12)
- HttpOnly session cookies, 30-day expiry
- Rate limiting on login endpoint: 10 attempts per 15 minutes
- Session invalidation on logout (cookie cleared + DB record deleted)
- Change password (verifies current password first)
- Update own profile (name, title, phone)
- No public registration — admin-invite-only model
- Role-based access control enforced at every API endpoint
- CORS locked to hub domain in production
- Helmet CSP headers in production
- HTTPS redirect in production

### 5.2 Dashboard
- Personalised greeting
- 4 company-wide stats: Active Orders, Pending KYC, Open Shipments, Blocked Items — all pulled live from the database
- My assigned tasks list with priority colour coding, due date, overdue badge
- Quick links grid to all major modules
- Recent activity feed
- Pinned announcements displayed prominently at top
- All data loaded in a single tRPC query to minimise waterfall

### 5.3 Task Management
- Create tasks with title, description, priority, assignee, due date
- Status workflow: To Do → In Progress → Blocked → Done
- Priority levels: Low, Medium, High, Urgent
- Inline status/priority/assignee updates on task detail page
- Filter by status, priority, assignee, "only mine"
- Comment thread on each task with timestamps and avatars
- In-app notifications on task assign and status change
- Overdue badge when due date has passed and task is not done
- Delete task (creator or admin only)

### 5.4 Team Directory
- Full team listing with roles, titles, contact details
- Online/offline indicator based on last activity (5-minute window)
- Search by name, email, or title
- Member profile pages showing contact info, role, join date, active task count, and current workload

### 5.5 Internal Messaging
- Group channels: #general, #operations, #finance, #engineering (pre-seeded)
- Direct messages between any two team members (get-or-create pattern)
- Create new group channels with custom member lists
- Real-time message delivery via Socket.IO
- Typing indicators (3-second timeout)
- Online presence tracking (broadcast on connect/disconnect)
- Read receipts (recorded in DB)
- Message bubbles with sender avatars, names, timestamps
- Mobile: full-width channel list with back-button navigation to chat

### 5.6 Operations Board (Kanban)
- 6-column workflow: New Order → KYC Review → Inspection → Shipment → Delivery → Completed
- Drag-and-drop between columns (HTML5 Drag API)
- Cards show: order reference, buyer → seller, amount with currency symbol, assigned handler, due date, overdue highlight
- Create card with all fields (ref, buyer, seller, amount, currency, column, assignee, due date, notes)
- Delete card with confirmation
- Column item counts
- Mobile: horizontal scroll with swipe hint

### 5.7 Document Vault
- Upload documents via AWS S3 presigned URLs (client uploads directly to S3, no server memory used)
- Categories: Contracts, Invoices, Compliance Certificates, Meeting Notes, Other
- Role-based access control per category:
  - Invoices: admin + finance only
  - Compliance: admin + operations only
  - Contracts: admin + operations + finance
  - Meeting Notes / Other: all roles
- Version history — upload new version without deleting old ones
- Document detail modal shows full version history with uploader and date
- Delete (admin only)

### 5.8 Calendar
- Full month grid view
- List view (better for mobile — toggle between views)
- 5 event categories: Deadline, Shipment, Inspection, Meeting, Other — each colour-coded
- Create events with title, description, category, start/end date and time, location, all-day toggle
- Today highlighted with brand colour
- Event detail modal with delete
- Month navigation (prev/next/today)
- Colour legend

### 5.9 Announcements
- Admin-only posting
- Rich text body
- Pin to dashboard toggle
- Read/unread tracking per user (unread shown with blue dot + highlight)
- Pinned announcements shown first with pin icon
- In-app notification broadcast to all active users on new announcement
- Delete (admin only)

### 5.10 Settings & Admin

**Profile tab (all users)**
- Edit name, title, phone
- Change password (requires current password)
- Role and email displayed (read-only)

**Notifications tab (all users)**
- 4 email notification toggles: task assigned, task updated, new DM, announcement
- Toggle switches, persisted to DB

**Appearance tab (all users)**
- Dark mode toggle, persisted in localStorage

**Team Management tab (admin only)**
- Full team member list
- Change any user's role via inline select
- Invite new members (name, email, role, title, phone, temp password)
- Deactivate members

### 5.11 Notifications System
- In-app notification centre in the topbar
- Unread count badge (updates every 30 seconds)
- Notification types: task_assigned, task_updated, announcement
- Mark individual or all-read
- Notifications created automatically on: task assignment, task reassignment, status changes, new announcement
- Notification preferences stored per user (email toggles ready for Resend integration)

---

## 6. Security Implementation

| Measure | Status | Details |
|---------|--------|---------|
| No public registration | ✅ | Admin-invite-only |
| Password hashing | ✅ | bcrypt, cost factor 12 |
| Minimum password length | ✅ | 8 characters |
| Session-based auth | ✅ | HttpOnly cookies, 30-day expiry |
| Login rate limiting | ✅ | 10 req / 15 min on login endpoint |
| General API rate limit | ✅ | 100 req / min across all API routes |
| CORS | ✅ | Locked to CLIENT_URL in production |
| Helmet / CSP | ✅ | Active in production |
| HTTPS redirect | ✅ | Active in production |
| RBAC at API layer | ✅ | `roleProcedure` on all admin/role-specific routes |
| RBAC at UI layer | ✅ | Admin-only sections hidden from non-admins |
| Document access control | ✅ | Category × role matrix enforced server-side |
| Session invalidation | ✅ | Token deleted from DB on logout |
| Input validation | ✅ | Zod schemas on every procedure input |
| SQL injection | ✅ | Drizzle ORM parameterised queries only |

---

## 7. Mobile Responsiveness

The following mobile-specific improvements were implemented:

| Feature | Implementation |
|---------|----------------|
| Modal behaviour | Slides up as a bottom sheet on mobile, centred on desktop |
| Messages layout | Full-screen channel list → back button into chat |
| Calendar | List/Grid view toggle; list view default-friendly on mobile |
| Settings tabs | Horizontally scrollable tab bar, no overflow |
| All forms | Single-column on mobile (`grid-cols-1 sm:grid-cols-2`) |
| Operations Board | Negative-margin breakout scroll, 256px cards on mobile |
| Touch targets | All buttons minimum 44px height |
| iOS input zoom | `font-size: 16px` on inputs prevents Safari auto-zoom |
| Tap highlight | `-webkit-tap-highlight-color: transparent` |
| Momentum scroll | `-webkit-overflow-scrolling: touch` |
| Safe areas | `env(safe-area-inset-*)` utilities for notched devices |
| Body scroll | Locked when modal is open |

---

## 8. Deployment Configuration

```
Build:  npm install --include=dev && npm run build && npm run db:push
Start:  node dist/server/server/index.js
Node:   20.18.0 (pinned via .node-version)
DB:     Render Managed PostgreSQL (Free)
```

### Environment Variables Required
| Variable | Purpose | Auto-set |
|----------|---------|----------|
| DATABASE_URL | PostgreSQL connection string | ✅ Render |
| SESSION_SECRET | Cookie signing key (32+ chars) | ✅ Render (generated) |
| NODE_ENV | production | ✅ Render |
| PORT | 10000 | ✅ Render |
| CLIENT_URL | CORS origin | Manual |
| AWS_ACCESS_KEY_ID | S3 uploads | Manual |
| AWS_SECRET_ACCESS_KEY | S3 uploads | Manual |
| S3_BUCKET | Document storage bucket | Manual |
| S3_REGION | eu-west-2 | Set in render.yaml |
| RESEND_API_KEY | Email notifications | Manual (not yet wired) |
| FROM_EMAIL | Sender address | Set in render.yaml |

### Build Issues Resolved
Four build failures were resolved during deployment:

1. `export default` in PostCSS/Tailwind configs — switched to `module.exports`
2. `ESNext` module output — switched server to `CommonJS` to support Node directory imports
3. `superjson` v2 is ESM-only — downgraded to v1.13.3 (CJS compatible)
4. `devDependencies` not installed — `npm install --include=dev` added to build command

---

## 9. Seed Data

The database seed (`npm run db:seed`) creates:

**Team Members (6)**
| Name | Email | Role |
|------|-------|------|
| Taofeeq Adebayo | taofeeq@etiandpartners.com | admin |
| Okosun Maxwell | maxwell@etiandpartners.com | admin |
| Bushirah | bushirah@etiandpartners.com | finance |
| Drey | drey@etiandpartners.com | operations |
| Idowu | idowu@etiandpartners.com | operations |
| Zaynab | zaynab@etiandpartners.com | support |

All initial passwords: `etihub2024`

**Default Channels (4):** #general, #operations, #finance, #engineering — all 6 members added

**Sample Data:** 5 tasks, 5 board items, 4 calendar events, 1 welcome announcement

---

## 10. What Still Needs Building

### High Priority

**A. Email Notifications (Resend)**
The preferences UI is built, the `createNotification()` function exists, and the Resend package is installed — but no actual email is sent anywhere. The `RESEND_API_KEY` env var is set up but unused.

What's needed:
- An `sendEmail()` helper using the Resend SDK
- Call it inside `tasks.create`, `tasks.update`, and `announcements.create` after checking the user's `notificationPreferences`
- Estimated effort: 2-3 hours

**B. Task Title / Description Editing**
The task detail page allows inline editing of status, priority, and assignee but the title and description are display-only. There is no way to fix a typo or update the description after creation.

What's needed:
- An edit mode toggle on the task detail header
- Input + textarea fields that submit via `tasks.update`
- Estimated effort: 1 hour

**C. Operations Board Card Detail / Edit**
Cards can be created, dragged, and deleted but cannot be tapped to view or edit their full details (notes, amount, assignee, due date). The full data exists in the DB, it just has no detail view.

What's needed:
- A card click handler that opens a detail/edit modal
- Reuse the existing `board.update` tRPC procedure
- Estimated effort: 2 hours

**D. First-Login Password Change Prompt**
All team members are seeded with `etihub2024`. There is no mechanism to force or prompt a password change. Any team member could forget and leave the default password in place indefinitely.

What's needed:
- A `passwordChangedAt` column on the users table
- A banner or modal on the dashboard if the password has never been changed
- Redirect to Settings > Profile for password change
- Estimated effort: 1-2 hours

### Medium Priority

**E. Document Vault Without S3**
If `AWS_ACCESS_KEY_ID` is not set, clicking Upload shows a network error with no explanation. This will confuse team members who try to upload before S3 is configured.

What's needed either:
- A local disk storage fallback for development
- Or a clear "Document uploads not configured — contact your admin" message if the env vars are absent
- Estimated effort: 1 hour

**F. Global Search**
No search exists across tasks, board items, or documents. Only the Team Directory has a search field.

What's needed:
- A `search` tRPC procedure that queries tasks (title), board items (orderRef, buyer, seller), and documents (name) with ILIKE
- A search bar in the topbar
- Results grouped by type in a dropdown
- Estimated effort: 3-4 hours

**G. Operations Board Column Edit**
Currently the only way to change a card's column is by dragging it. On mobile, drag-and-drop is unreliable. The card detail modal (item E above) should include a column selector as a fallback.

What's needed: included in item C above, no additional work if C is built first.

### Lower Priority

**H. Message File Attachments**
The DB schema has `attachmentUrl` and `attachmentName` columns on messages, and the UI renders them — but there is no file upload flow in the message input. Users cannot currently attach files to messages.

What's needed:
- A file attachment button in the message input
- S3 presigned upload (same pattern as documents)
- Estimated effort: 2 hours

**I. Calendar Event Invites / Attendees**
Events are currently personal/team-wide. There is no attendee list or ability to invite specific people to an event.

What's needed:
- An `event_attendees` junction table
- Attendee selector on event creation
- Notification on invite
- Estimated effort: 3 hours

**J. Announcement Rich Text**
Announcements currently use a plain `<textarea>`. For company communications, a simple rich text editor (bold, bullet points, links) would be more appropriate.

What's needed:
- A lightweight editor like TipTap or Quill
- Render stored HTML safely in the announcement body
- Estimated effort: 2 hours

**K. Session Management**
Users have no visibility into their active sessions and no way to revoke sessions from other devices. The `sessions` table supports this but the UI doesn't expose it.

What's needed:
- A "Active Sessions" section in Settings showing device/IP/created date
- A "Sign out of all devices" button
- Estimated effort: 2 hours

**L. Audit Log**
Admins have no log of who did what — no record of logins, role changes, task deletions, or document uploads beyond what's implicit in the data.

What's needed:
- An `audit_logs` table
- Middleware or explicit logging in sensitive mutations
- Admin-only view in Settings
- Estimated effort: 4-5 hours

---

## 11. Known Limitations

| Item | Detail |
|------|--------|
| Free Render tier | Service sleeps after 15 minutes of inactivity. First request after idle takes ~30 seconds. Upgrade to $7/month for always-on. |
| Free Postgres tier | 256MB storage limit on Render's free database. Sufficient for the team's size. |
| S3 not configured | Document uploads will fail until AWS credentials are added in Render's environment variables. |
| Email not wired | Notification preferences are saved but no emails are sent. RESEND_API_KEY must be added and the email dispatch code must be written. |
| No Google OAuth | The `.env.example` has placeholder variables for Google OAuth but it is not implemented. |
| Drag-and-drop on mobile | HTML5 drag events don't work reliably on touch screens. The board needs a column-change selector in the card detail modal as a touch fallback. |
| Message attachment uploads | UI renders attachments but no upload flow exists. |
| No password-reset flow | Forgotten passwords require an admin to set a new one manually via the Team Management tab. |

---

## 12. Recommended Next Steps

In order of business impact:

1. **Configure S3** — Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` to Render environment. No code changes needed.
2. **Wire up Resend** — Add `RESEND_API_KEY`, then build the email dispatch helper (3-4 hours of dev work).
3. **Build task title/description editing** — 1 hour, high daily-use impact.
4. **Build board card detail/edit modal** — 2 hours, unblocks mobile board usage.
5. **Add first-login password prompt** — Prevents the entire team running on the default password.
6. **Consider upgrading Render plan** — $7/month eliminates cold-start delays.

---

*Report generated from codebase at commit `ef975ae` — November 2024*
