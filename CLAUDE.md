# Quid — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. Portfolio project with real users.

## Tech Stack & Versions
- **Next.js 16** (App Router, React 19, TypeScript strict)
- **PostgreSQL** via Supabase (data host) + **Prisma 7** (ORM, driver adapter pattern)
- **Supabase Auth** (email/password; Google OAuth planned)
- **Tailwind CSS 4**, **Zod 4** (validation), **Vitest 4** (testing)
- **Deployed on Vercel** at `https://gregbigelow.com/quid`

## Quick Start
```bash
npm run dev              # Dev server (localhost:3000/quid)
npm run build            # Production build (runs prisma generate first)
npm run lint             # ESLint
npm test                 # Vitest (run once)
npx prisma migrate dev   # Run migrations (reads prisma.config.ts → .env.local)
npx prisma generate      # Regenerate Prisma client → app/generated/prisma/
npx prisma studio        # Visual DB browser
vercel logs --follow                   # Stream live production logs
vercel logs --level error --since 1h   # Recent errors only
vercel logs --environment production --expand  # Full log details
vercel ls                              # List recent deployments
vercel inspect [url|id]                # Deployment details/status
vercel rollback                        # Quick revert to previous deployment
vercel promote [url|id]                # Promote preview → production
vercel redeploy [url|id]               # Rebuild and redeploy
vercel env pull                        # Sync env vars from Vercel → .env.local
vercel env ls                          # List all env vars in Vercel project
```

## Environment Variables
All in `.env.local` (see `.env.local.example`):
- `DATABASE_URL` — Direct (non-pooled) Supabase Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `NEXT_PUBLIC_SITE_URL` — `https://gregbigelow.com/quid` in prod, falls back to `http://localhost:3000/quid` in dev

## Project Structure
No `src/` directory — all code at repo root.
```
app/
  (auth)/login|signup/       # Public auth pages (client components)
  auth/callback/route.ts     # Email confirmation → session exchange → redirect
  (app)/layout.tsx           # Auth guard wrapper (redirects unauthed to /login)
  (app)/dashboard/           # Group list + create group modal
  (app)/groups/[id]/         # Group detail: members, expenses, balances + forms
  api/groups/                # REST API (see API Routes below)
  generated/prisma/          # Auto-generated — do NOT edit
  layout.tsx                 # Root layout (fonts, metadata)
  page.tsx                   # Root redirect (authed → dashboard, else → login)

components/
  Nav.tsx                    # Top nav with logout (client component)
  ui/Button|Card|Input.tsx   # Reusable styled components

lib/
  prisma/client.ts           # Prisma singleton (pg Pool + PrismaPg adapter)
  supabase/client.ts         # Browser Supabase client
  supabase/server.ts         # Server Supabase client (cookie-aware, for RSC/routes)
  balances/simplify.ts       # Debt simplification — pure function, 14 tests

prisma/schema.prisma         # DB schema (5 models, see below)
proxy.ts                     # Auth middleware (Next.js 16 uses proxy.ts, not middleware.ts)
```

## Data Models
All monetary values are integers (cents). Never floats.
```
User        — id (UUID), email (unique), displayName, avatarUrl?, createdAt
Group       — id, name, createdAt, createdById → User
GroupMember — id, groupId, userId, joinedAt  [unique: groupId+userId, cascade delete]
Expense     — id, groupId, paidById → User, description, amountCents, date, createdAt
ExpenseSplit— id, expenseId, userId, amountCents  [cascade delete on expense]
```

## API Routes
All return `{ data, error }` JSON. Auth required (Supabase session checked via server client).
```
GET  /api/groups                    — List user's groups
POST /api/groups                    — Create group (+ auto-add creator as member)
POST /api/groups/[id]/members       — Add member by email
POST /api/groups/[id]/expenses      — Create expense with equal split (transaction)
GET  /api/groups/[id]/balances      — Simplified debts with display names
```

## Architecture Rules
1. **Auth = Supabase, Data = Prisma.** Never query data through Supabase JS client.
2. **Server Components by default.** Client components (`"use client"`) only for interactivity.
3. **Business logic stays pure.** `lib/balances/simplify.ts` has zero framework deps — keep it that way.
4. **REST API is mobile-ready.** Routes are resource-oriented, not page-specific.
5. **Zod validates at API boundaries.** Schemas defined inline in route handlers currently.

## Gotchas & Patterns

### Next.js 16 specifics
- **`params` is a Promise**: `const { id } = await params` in pages and route handlers.
- **Auth middleware is `proxy.ts`**, not `middleware.ts`. This is the Next.js 16 convention.
- **`basePath: "/quid"`**: Internal routing uses relative paths (`router.push("/dashboard")`), but external URLs (Supabase email redirects) must use the full URL: `${NEXT_PUBLIC_SITE_URL}/auth/callback`.

### Prisma
- Import: `import { prisma } from "@/lib/prisma/client"` (named export).
- Uses `@prisma/adapter-pg` with a `pg.Pool` — no direct Prisma connection string at runtime.
- Generated output: `app/generated/prisma/` (not node_modules). `npm run build` runs `prisma generate` automatically.
- `prisma.config.ts` loads `.env.local` via dotenv so the CLI can find `DATABASE_URL`.

### Expense splitting
- Equal split: total divided evenly, remainder distributed 1 cent at a time to first N members.
- Created atomically via `prisma.$transaction` (expense + all splits in one call).

### Auth flow
- Signup sends confirmation email with `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback`.
- Signup page shows "check your email" — does NOT redirect (user isn't authed until they click the link).
- `auth/callback/route.ts` exchanges the code for a session, then redirects to `/dashboard`.
- Supabase dashboard must have Site URL = `https://gregbigelow.com/quid` and redirect allowlist including the callback URL.

## Code Conventions
- TypeScript strict mode. No `any`.
- `async/await`, not `.then()`.
- Named exports (except Next.js page/layout defaults).
- Functional components with hooks. No classes.

## Reference Files
- **PLANNING.md** — Architecture decisions with rationale, open design questions, future roadmap. Consult before structural changes.
- **TODOS.md** — What's done, what's in progress, what's in the backlog.
