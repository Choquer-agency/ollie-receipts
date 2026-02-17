# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ollie Receipts is a receipt management app that lets users upload receipts, extract data via AI (Google Gemini OCR), and publish transactions to QuickBooks Online. It uses Clerk for authentication, Cloudflare R2 for file storage, and Neon PostgreSQL for the database.

## Development Commands

```bash
# Frontend dev server (port 3331)
npm run dev

# Backend dev server with hot-reload (port 4000)
cd server && npm run dev

# Full build (frontend + backend)
npm run build

# Build individually
npm run build:frontend    # tsc && vite build
npm run build:backend     # cd server && npm install && npm run build
```

Both frontend and backend must run simultaneously for local development. All environment variables (frontend and backend) live in a single root `.env` file. The backend loads it via `server/src/config/env.ts` which resolves the path relative to `__dirname`.

## Architecture

**Frontend** (`src/`): React 19 + TypeScript + Vite. No router — the app uses view state (`list` | `review`) managed in `App.tsx`. Styling uses CSS custom properties from the design system (no Tailwind). Gemini OCR runs client-side in `services/geminiService.ts`.

**Backend** (`server/src/`): Express.js + TypeScript. Uses Neon serverless PostgreSQL with raw SQL (no ORM). Request flow: Clerk middleware → auth middleware (converts Clerk ID to internal UUID in `middleware/auth.ts`) → controller.

**Key integrations:**
- **Clerk** — Auth provider. Frontend uses `@clerk/clerk-react`, backend uses `@clerk/express`
- **Google Gemini** — OCR receipt extraction (model: `gemini-3-flash-preview`), runs on the frontend
- **Cloudflare R2** — S3-compatible file storage via AWS SDK. Files stored as `receipts/{userId}/{timestamp}-{filename}`
- **QuickBooks Online** — OAuth2 integration for publishing expenses/bills. Hybrid token refresh strategy (proactive on activity, reactive on access, weekly background cron job)
- **Neon PostgreSQL** — Three tables: `users`, `receipts`, `quickbooks_connections` (see `server/src/db/schema.sql`)

## Design System Rules

All UI must use CSS custom properties from `design-system/tokens.css`. Key constraints:
- **No hardcoded colors or Tailwind utilities** — use `var(--text-primary)`, `var(--primary)`, etc.
- **Font weights**: only 400 (body) and 600 (headings), exception: H1 uses 700
- **Button sizes**: only small (32px) and default (40px) — no large buttons
- **Border radius**: only `--radius-md` (6px) and `--radius-xl` (12px)
- **Card padding**: only `--card-padding-mobile` (16px) and `--card-padding-desktop` (24px)
- **Elevation**: 3 levels only — flat (none), raised (`--shadow-raised`), overlay (`--shadow-overlay`)
- **Text**: proper case only, never ALL CAPS for labels

See `design-system/AI_CONTEXT.md` for full rules with code examples.

## Database

Raw SQL via `@neondatabase/serverless` (no ORM). Schema in `server/src/db/schema.sql`. All tables use UUID primary keys with `uuid_generate_v4()`. The `receipts` table has an `updated_at` trigger. QuickBooks connections enforce one connection per user via UNIQUE constraint.

## Deployment

Deployed on Railway. Config in `server/railway.json`. In production, the Express server serves the built frontend from `/dist`. Health check at `/health`.

## Key Patterns

- API service (`src/services/apiService.ts`) has automatic 401 retry with token refresh for handling expired Clerk tokens during batch uploads
- QuickBooks OAuth uses a popup window flow with state encoding for user ID; tokens are stored per-user in the database
- Duplicate detection for receipts uses filename matching (`server/src/controllers/receiptController.ts`)
- The `publishTarget` field on receipts determines whether to create an Expense or Bill in QuickBooks
