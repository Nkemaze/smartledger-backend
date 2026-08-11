# SmartLedger Backend

Node.js/Express + TypeScript + PostgreSQL (via Prisma) API for SmartLedger.

## Folder Structure

```
smartledger-backend/
├── prisma/
│   └── schema.prisma        # Database schema (source of truth for tables)
├── src/
│   ├── config/               # env loading, Prisma client singleton
│   ├── modules/               # one folder per business domain (feature-based)
│   │   ├── auth/              # signup, login, OTP  \u2013 fully implemented
│   │   ├── users/              # staff management, roles & performance \u2013 fully implemented
│   │   ├── sync/               # offline push/pull sync engine \u2013 fully implemented
│   │   ├── business/            # shop profile & settings \u2013 implemented
│   │   ├── transactions/        # sales & expenses (incl. VAT, stock decrement) \u2013 implemented
│   │   ├── inventory/           # products & stock (CRUD + adjust) \u2013 implemented
│   │   ├── customers/           # customer CRM \u2013 implemented
│   │   ├── suppliers/           # supplier CRM \u2013 implemented
│   │   ├── tax/                 # VAT ledger, summary & filings \u2013 implemented
│   │   ├── advisor/             # rule-based AI business advisor \u2013 implemented
│   │   ├── whatsapp/            # WhatsApp Business integration \u2013 scaffolded
│   │   ├── reports/             # dashboard, P&L, balance sheet, CSV export \u2013 implemented
│   │   ├── archive/             # document upload & digital archive \u2013 implemented
│   │   └── notifications/       # in-app alerts & reminders \u2013 implemented
│   ├── middleware/            # auth, role (RBAC), validation, error handling
│   ├── services/               # cross-cutting external integrations (SMS, storage, WhatsApp, LLM)
│   ├── utils/                  # shared helpers (errors, async handler, logger, response shape)
│   ├── jobs/                   # scheduled/cron jobs (e.g., daily WhatsApp summary)
│   ├── app.ts                  # Express app assembly (all routes mounted here)
│   └── server.ts               # entry point
└── tests/
```

## Module Pattern

Every module follows the same four-file shape (see `modules/auth` or `modules/users` for a complete example):

- `*.validation.ts` \u2013 Zod schemas for request input
- `*.service.ts` \u2013 business logic, talks to Prisma
- `*.controller.ts` \u2013 thin HTTP layer, calls the service, shapes the response
- `*.routes.ts` \u2013 wires up Express routes + which middleware guards them

Modules marked "scaffolded" in the tree above have a working route file but no
real logic yet \u2013 build them out following the same four-file pattern.

## Role Model

Implemented in `middleware/role.middleware.ts`, matching the SRS (Section 2.4):
by default a single OWNER account has full access to everything. Restrictions
only apply once the Owner explicitly adds a staff account under CASHIER or
ACCOUNTANT (see `modules/users`).

## Offline Sync

`modules/sync` implements the push/pull pattern described in the
Technological Realisation document: clients generate their own UUIDs offline,
queue changes locally, then push them here once back online. Conflicts are
resolved last-write-wins based on `updatedAt`, and every change is recorded
in `AuditLog` so nothing is silently lost.

## Getting Started

```bash
cp .env.example .env          # fill in your real DATABASE_URL, JWT_SECRET, etc.
npm install
npm run prisma:migrate        # creates tables from prisma/schema.prisma
npm run dev                   # starts the API on http://localhost:4000
```

Health check: `GET /health`
