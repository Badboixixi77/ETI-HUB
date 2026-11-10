# ETI Hub — Build Prompt for Kiro

Copy the contents below into a new Kiro session to start building.

---

Build me a full-stack internal team hub application called **ETI Hub** — a separate project from the ETI Marketplace. This is an internal operations and collaboration platform for the ETI & PARTNERS LIMITED team (Lagos · London).

## What It Is

ETI Hub is a private, internal-only web application for the ETI team to manage daily operations, track work, communicate, and coordinate across the UK-Nigeria trade corridor. It is NOT public-facing and NOT part of the ETI Marketplace codebase. It should be a brand new standalone project.

## Who Uses It

The team includes:
- **Director** (Taofeeq Adebayo) — full access, admin role
- **Lead Developer** (Okosun Maxwell) — full access, admin role
- **Finance** (Bushirah) — finance role, access to budgets, payments, invoices
- **Operations** (Drey / Idowu) — operations role, access to manifests, logistics, shipments
- **Onboarding/Support** (Zaynab and team) — support role, access to seller onboarding, KYC status, tickets
- Additional team members may be added later

## Key Features (Build These)

### 1. Dashboard
- Personalised dashboard per user showing their assigned tasks, pending items, and recent activity
- Company-wide stats: active orders, pending KYC reviews, open shipments, unresolved tickets
- Quick links to each module

### 2. Task Management
- Create, assign, and track tasks with due dates, priority levels, and status (todo, in progress, blocked, done)
- Tasks can be assigned to specific team members
- Filter by assignee, priority, status, due date
- Comment thread on each task
- Email or in-app notification when a task is assigned or updated

### 3. Team Directory
- List all team members with their role, contact details, and current workload
- Show who is online / last active
- Profile pages with responsibilities and recent activity

### 4. Internal Messaging
- Direct messages between team members
- Group channels (e.g., #operations, #finance, #engineering, #general)
- Read receipts
- File attachments (images, documents)

### 5. Operations Board
- Kanban-style board for tracking ongoing trade operations
- Columns: New Order → KYC Review → Inspection → Shipment → Delivery → Completed
- Each card shows: order reference, buyer, seller, amount, assigned handler, due date
- Drag-and-drop between columns
- This is a lightweight view — it does NOT connect to the ETI Marketplace database. It's a manual tracking board for internal coordination.

### 6. Document Vault
- Upload and store internal documents (contracts, invoices, compliance certificates, meeting notes)
- Organised by category and date
- Role-based access — finance can see invoices, operations can see shipping docs, etc.
- Version history on documents

### 7. Calendar & Scheduling
- Team calendar showing deadlines, shipments, inspections, meetings
- Colour-coded by category
- Set reminders and notifications

### 8. Announcements
- Director or admin can post company-wide announcements
- Pinned at the top of the dashboard
- Read / unread tracking

### 9. Settings & Admin
- User management — invite team members, assign roles, deactivate
- Role management — admin, finance, operations, support, developer
- Notification preferences per user
- Dark mode toggle

## Tech Stack

Use the same stack as the ETI Marketplace for consistency:
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS — clean, modern, professional. Use a deep navy (#0f2d5c) as the primary brand colour with white backgrounds. Minimal, not cluttered. Think Linear or Notion aesthetic.
- **Backend:** Express.js + tRPC (type-safe API)
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Email + password with bcrypt, session cookies (30-day expiry). Support Google OAuth later.
- **File storage:** S3 (AWS) for document uploads
- **Real-time:** WebSocket for messaging and live notifications
- **Hosting:** Render
- **Email:** Resend or similar for notifications

## Design Guidelines

- Clean, minimal interface — no unnecessary clutter
- Sidebar navigation (collapsible on mobile)
- Responsive — must work on mobile (team members in Nigeria may use phones)
- Loading states and error handling on every action
- Toast notifications for success/error feedback
- Dark mode support
- Professional B2B aesthetic — this is an internal tool, not a consumer app

## Security Requirements

- Private app — no public registration. Only admin can invite users.
- Role-based access control on every endpoint and UI element
- Password minimum 8 characters
- Rate limiting on login
- All API routes authenticated
- CORS locked to the hub domain only
- CSP headers with Helmet
- HTTPS redirect in production

## Project Structure

```
eti-hub/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── main.tsx
│   └── index.html
├── server/          # Express + tRPC backend
│   ├── _core/       # auth, context, middleware
│   ├── routers/     # tRPC routers
│   └── db/          # Drizzle queries
├── drizzle/         # Migrations
└── package.json
```

Start by scaffolding the full project — set up the monorepo structure, install all dependencies, configure the database schema with Drizzle, set up tRPC with authentication, and build the dashboard layout with sidebar navigation. Then build each module one by one, starting with auth, then dashboard, then tasks, then the rest.
