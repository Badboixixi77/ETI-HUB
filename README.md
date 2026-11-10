# ETI Hub

Internal team operations and collaboration platform for ETI & PARTNERS LIMITED (Lagos · London).

This is a private, internal-only web application for the ETI team to manage daily operations, track work, communicate, and coordinate across the UK-Nigeria trade corridor. It is NOT public-facing and NOT part of the ETI Marketplace codebase.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS (deep navy #0f2d5c primary, white backgrounds, Linear/Notion aesthetic)
- **Backend:** Express.js + tRPC (type-safe API)
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Email + password with bcrypt, session cookies (30-day expiry)
- **File storage:** AWS S3
- **Real-time:** WebSocket for messaging and live notifications
- **Hosting:** Render
- **Email:** Resend for notifications

## Features

1. **Dashboard** — personalised per user with tasks, pending items, recent activity
2. **Task Management** — create, assign, track tasks with due dates, priority, comments
3. **Team Directory** — member profiles, roles, contact details, workload
4. **Internal Messaging** — direct messages + group channels with file attachments
5. **Operations Board** — Kanban board for tracking trade operations (order → KYC → inspection → shipment → delivery)
6. **Document Vault** — internal documents with role-based access and version history
7. **Calendar & Scheduling** — team calendar with deadlines, shipments, meetings
8. **Announcements** — company-wide posts pinned to dashboard
9. **Settings & Admin** — user management, roles, notification preferences, dark mode

## Team Roles

| Role | Users | Access |
|------|-------|--------|
| Admin | Taofeeq Adebayo (Director), Okosun Maxwell (Lead Dev) | Full access |
| Finance | Bushirah | Budgets, payments, invoices |
| Operations | Drey / Idowu | Manifests, logistics, shipments |
| Support | Zaynab and team | Seller onboarding, KYC status, tickets |

## Security

- Private app — no public registration, admin invite only
- Role-based access control on every endpoint and UI element
- Rate limiting on login, CORS locked to hub domain
- CSP headers with Helmet, HTTPS redirect in production
- Password minimum 8 characters

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

## Build Prompt

See [BUILD-PROMPT.md](./BUILD-PROMPT.md) for the full specification prompt to feed into Kiro.
