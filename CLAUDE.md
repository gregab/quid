# Quid — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. **This is a live production app with real users — treat it accordingly.** Security, correctness, and reliability matter; abuse prevention matters. Don't cut corners that would be fine for a demo but unacceptable in production.

## Tech Stack & Versions
- **Next.js 16** (App Router, React 19, TypeScript strict)
- **PostgreSQL** via Supabase (data host) + **Prisma 7** (ORM, driver adapter pattern)
- **Supabase Auth** (email/password; Google OAuth planned)
- **Tailwind CSS 4**, **Zod 4** (validation), **Vitest 4** (testing)
- **Deployed on Vercel** at `https://gregbigelow.com/quid`

## Testing After Changes
Run tests before and after every non-trivial change:

```bash
npm test                              # All unit + integration tests (fast, no network)
npm test tests/smoke.test.ts          # Smoke tests against live production site
```

**Test files:**
- `lib/balances/simplify.test.ts` — 14 unit tests for debt simplification logic
- `lib/supabase/supabase.test.ts` — Validates env vars + Supabase anon key works
- `tests/smoke.test.ts` — Production smoke tests (unauthenticated + optional authenticated)

**Smoke test setup:**
- Unauthenticated tests run with no extra config — they hit `www.gregbigelow.com/quid`
- Authenticated tests require `SMOKE_TEST_EMAIL` and `SMOKE_TEST_PASSWORD` in `.env.local` (a dedicated test account in Supabase)
- Skip all smoke tests in environments without internet: `SKIP_SMOKE_TESTS=1 npm test`

**What the smoke tests verify:**
1. Login and signup pages are publicly reachable and render HTML
2. Auth-protected pages (`/dashboard`, `/groups/:id`) redirect unauthenticated users to `/login`
3. All API endpoints return `401` when called without a session
4. (Authenticated) `GET /api/groups` returns `{ data: [], error: null }` shape
5. (Authenticated) `POST /api/groups` creates a group and returns `201`
6. (Authenticated) `GET /api/groups/:id/balances` returns simplified debts for own group

**Always run smoke tests after:** changing `proxy.ts`, auth routes, API routes, or env var handling.

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
- `SMOKE_TEST_EMAIL` — (optional) Email for a dedicated test account used by authenticated smoke tests
- `SMOKE_TEST_PASSWORD` — (optional) Password for the smoke test account

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

## Security Requirements
This app handles real user data and financial records. These are non-negotiable:

- **SSL certificate verification must be enabled.** `rejectUnauthorized: true` on all DB connections. Never disable cert verification as a convenience workaround — find the real fix.
- **All API routes must verify auth.** Every route handler checks the Supabase session server-side. No route should trust client-supplied user IDs without validating session ownership.
- **Users may only access their own data.** All Prisma queries must scope to the authenticated user's groups/expenses. Never return data the user isn't a member of.
- **Validate all input at API boundaries.** Use Zod schemas before any DB write. Reject unexpected fields.
- **No raw SQL with user input.** Use Prisma's parameterized queries only.
- **Rate limiting is not yet implemented** — a known gap. Avoid adding endpoints that could be trivially abused without first considering mitigations.

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

### SSL / Supabase DB connection
Supabase uses a private root CA ("Supabase Root 2021 CA") not in the system trust store. The correct fix is **not** `rejectUnauthorized: false` — that disables all cert verification. Instead, `lib/prisma/client.ts` bundles the Supabase Root CA cert inline and uses `ssl: { rejectUnauthorized: true, ca: SUPABASE_ROOT_CA }`.

Two issues had to be solved simultaneously:
1. **Bundled CA cert**: inlined in `client.ts` as a constant (it's public — the same cert for all Supabase projects using this CA).
2. **Strip `sslmode` from the connection string**: `pg-connection-string` parses `sslmode=require` from the `DATABASE_URL` and currently treats it as `verify-full`, overriding the `ssl` config passed to `pg.Pool`. We strip it with `url.searchParams.delete("sslmode")` before passing to the pool.

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

## Keeping Docs Current
After completing any non-trivial task, update these files if the work warrants it:

- **CLAUDE.md** — Update when: new patterns or gotchas are discovered, stack versions change, project structure changes, new env vars are added, new commands are needed, or existing instructions become inaccurate.
- **PLANNING.md** — Update when: an architectural decision is made or changed, a design question is resolved, or new open questions arise.
- **TODOS.md** — Update when: a task is completed (mark done), a new task is identified, or the scope/status of a backlog item changes.

Only update when the change is clearly relevant and accurate — don't pad these files with minor notes.
