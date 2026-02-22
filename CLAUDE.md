# Quid — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. **This is a live production app with real users — treat it accordingly.** Security, correctness, and reliability matter. Don't cut corners that would be fine for a demo but unacceptable in production.

## Tech Stack
- **Next.js 16** (App Router, React 19, TypeScript strict)
- **PostgreSQL** via Supabase (data host) + **Prisma 7** (ORM, driver adapter pattern)
- **Supabase Auth** (email/password)
- **Tailwind CSS 4**, **Zod 4**, **Vitest 4**
- **Deployed on Vercel** at `https://gregbigelow.com/quid`

## Default Workflow

For any change: understand the codebase, make changes, write tests for new behavior, run tests, commit, push. **Tests pass before shipping. Every completed task ends with a commit and push** (`git push origin main` → Vercel auto-deploys).

This applies to all task types — UI, copy, styling, refactors, bug fixes. Do not wait to be asked.

## Commands
```bash
# Development
npm run dev                # Dev server (localhost:3000/quid)
vercel dev                 # Mirrors Vercel prod env (preferred for debugging)
npm run build              # Production build (runs prisma generate first)
npm run lint               # ESLint

# Testing
SKIP_SMOKE_TESTS=1 npm test                    # Unit + integration (fast, no network)
npm test                                        # All tests including smoke (hits production)
npm test tests/smoke.test.ts                    # Smoke tests only (against production)
SMOKE_TEST_BASE_URL=http://localhost:3000/quid npm test tests/smoke.test.ts  # Smoke against local

# Database
npx prisma migrate dev     # Run migrations (reads prisma.config.ts → .env.local)
npx prisma generate        # Regenerate Prisma client → app/generated/prisma/
npx prisma studio          # Visual DB browser

# Deployment & Monitoring
git push origin main                              # Deploy (Vercel auto-builds)
vercel logs --follow                              # Live production logs
vercel logs --level error --since 1h              # Recent errors
vercel rollback                                   # Revert to previous deployment
```

## Environment Variables
All in `.env.local` (see `.env.local.example`):
- `DATABASE_URL` — Direct (non-pooled) Supabase Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `NEXT_PUBLIC_SITE_URL` — `https://gregbigelow.com/quid` in prod, falls back to `http://localhost:3000/quid` in dev
- `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` — (optional) Dedicated test account for authenticated smoke tests

## Project Structure
No `src/` directory — all code at repo root.
```
app/
  layout.tsx                        # Root layout (fonts, metadata)
  page.tsx                          # Root redirect (authed → dashboard, else → login)
  globals.css                       # Tailwind + custom animations

  (auth)/login/page.tsx             # Login page (client component)
  (auth)/signup/page.tsx            # Signup page with "check email" state (client)
  auth/callback/route.ts            # Email confirmation → session → upsert User → redirect

  (app)/layout.tsx                  # Auth guard: redirects unauthed to /login, renders Nav
  (app)/dashboard/
    page.tsx                        # Group list (server component)
    CreateGroupButton.tsx           # Modal for creating groups (client)
  (app)/groups/[id]/
    page.tsx                        # Group detail: balances, expenses, activity, members (server)
    GroupInteractive.tsx             # Client wrapper combining ExpensesList + ActivityFeed
    ExpensesList.tsx                 # Expense list with optimistic add/edit/delete
    AddExpenseForm.tsx              # Modal form with payer selection + participant filtering
    ExpenseActions.tsx              # Edit/delete buttons + modals per expense
    AddMemberForm.tsx               # Modal form for adding members by email
    ActivityFeed.tsx                 # Activity log display with relative timestamps
    useActivityLogs.ts              # Hook: optimistic activity log management

  api/groups/
    route.ts                        # GET (list groups) + POST (create group)
    [id]/members/route.ts           # POST (add member by email)
    [id]/expenses/route.ts          # POST (create expense with split)
    [id]/expenses/[expenseId]/route.ts  # PUT (edit) + DELETE
    [id]/balances/route.ts          # GET (simplified debts)

  generated/prisma/                 # Auto-generated Prisma client — do NOT edit

components/
  Nav.tsx                           # Top nav with logout (client)
  ui/Button.tsx                     # Button with variants
  ui/Card.tsx                       # Card container
  ui/Input.tsx                      # Input field

lib/
  prisma/client.ts                  # Prisma singleton (pg Pool + PrismaPg adapter + SSL)
  supabase/client.ts                # Browser Supabase client
  supabase/server.ts                # Server Supabase client (cookie-aware, for RSC/routes)
  balances/simplify.ts              # Debt simplification algorithm (pure function, zero deps)

prisma/schema.prisma                # 6 models (see Data Models below)
proxy.ts                            # Auth middleware (Next.js 16 convention, NOT middleware.ts)
```

## Data Models
All monetary values are integers (cents). Never floats.
```
User         — id (UUID), email (unique), displayName, avatarUrl?, createdAt
Group        — id, name, createdAt, createdById → User
GroupMember  — id, groupId, userId, joinedAt  [unique: groupId+userId, cascade delete]
Expense      — id, groupId, paidById → User, description, amountCents, date, createdAt
ExpenseSplit — id, expenseId, userId, amountCents  [cascade delete on expense]
ActivityLog  — id, groupId, actorId → User, action, payload (JSON), createdAt  [cascade delete on group]
```

ActivityLog actions: `"expense_added"`, `"expense_edited"`, `"expense_deleted"`. Payload: `{ description, amountCents, paidByDisplayName }`.

## API Routes
All return `{ data, error }` JSON. All require Supabase session (return 401 without).
```
GET    /api/groups                         — List user's groups
POST   /api/groups                         — Create group (+ auto-add creator as member)
POST   /api/groups/[id]/members            — Add member by email
POST   /api/groups/[id]/expenses           — Create expense with equal split (atomic transaction)
PUT    /api/groups/[id]/expenses/[eid]     — Edit expense + recalculate splits (atomic)
DELETE /api/groups/[id]/expenses/[eid]     — Delete expense (cascade deletes splits)
GET    /api/groups/[id]/balances           — Simplified debts with display names
```

All group endpoints verify the authenticated user is a member of the group (return 403 otherwise).

## Data Flow
```
Browser → proxy.ts (auth check) → Page/Route Handler
                                      ↓
                              Supabase server client (get session)
                                      ↓
                              Prisma (query/mutate data)
                                      ↓
                              PostgreSQL (Supabase-hosted)
```
- **Read paths**: Server Components fetch via Prisma, render HTML.
- **Write paths**: Client components POST to API routes → Zod validates → Prisma mutates → JSON response.
- **Balances**: Computed on-demand from expense/split data. No stored balance table.

## Architecture Rules
1. **Auth = Supabase, Data = Prisma.** Never query data through Supabase JS client.
2. **Server Components by default.** `"use client"` only for interactivity.
3. **Business logic stays pure.** `lib/balances/simplify.ts` has zero framework deps.
4. **REST API is mobile-ready.** Routes are resource-oriented, not page-specific.
5. **Zod validates at API boundaries.** Schemas defined inline in route handlers.

## Security Requirements
Non-negotiable for this production app:
- **SSL cert verification enabled.** `rejectUnauthorized: true` on all DB connections. Never disable.
- **All API routes verify auth.** Every handler checks Supabase session server-side.
- **Users access only their own data.** All queries scope to authenticated user's groups.
- **Validate all input with Zod.** Reject unexpected fields at API boundaries.
- **No raw SQL with user input.** Prisma parameterized queries only.

## Gotchas

### Next.js 16
- **`params` is a Promise**: `const { id } = await params` in pages and route handlers.
- **Auth middleware is `proxy.ts`**, not `middleware.ts`.
- **`basePath: "/quid"`**: Internal routing uses relative paths (`router.push("/dashboard")`). External URLs (Supabase email redirects) must use `${NEXT_PUBLIC_SITE_URL}/auth/callback`.

### basePath & fetch URLs (common bug source)
**Never use `NEXT_PUBLIC_SITE_URL` in client-side `fetch()`.** It hardcodes the domain, causing CORS failures when Vercel serves at `www.` vs non-`www`. This bug has occurred twice. Instead:
```ts
const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
fetch(`${basePath}/api/groups`, ...);  // Root-relative, no CORS issues
```

### Prisma
- Import: `import { prisma } from "@/lib/prisma/client"` (named export).
- Uses `@prisma/adapter-pg` with `pg.Pool` — no direct Prisma connection string at runtime.
- Generated output: `app/generated/prisma/` (not node_modules). `npm run build` runs `prisma generate` automatically.
- `prisma.config.ts` loads `.env.local` via dotenv so CLI can find `DATABASE_URL`.

### SSL / Supabase DB Connection
`lib/prisma/client.ts` bundles the Supabase Root CA cert inline and uses `ssl: { rejectUnauthorized: true, ca: SUPABASE_ROOT_CA }`. Also strips `sslmode` from the connection string (pg-connection-string misparses it, overriding the ssl config).

### Optimistic Updates
Expenses and activity logs use optimistic UI updates. Pattern:
1. Client applies change immediately with `isPending: true`
2. Sends request to API
3. On success: `router.refresh()` reconciles server state
4. On failure: reverts via `router.refresh()`
Pending items have fade animations. See `ExpensesList.tsx` and `useActivityLogs.ts`.

### Auth Flow
- Signup → confirmation email with `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback`
- Signup page shows "check your email" (does NOT redirect — user isn't authed yet)
- `auth/callback/route.ts` exchanges code for session, upserts User in Prisma, redirects to `/dashboard`
- Supabase dashboard must have Site URL = `https://gregbigelow.com/quid` and callback URL in redirect allowlist

### Expense Splitting
- Equal split: total ÷ participants, remainder distributed 1 cent at a time to first N members
- Created atomically via `prisma.$transaction` (expense + splits + activity log)

## Testing
```
lib/balances/simplify.test.ts           — 14 unit tests (debt simplification)
lib/supabase/supabase.test.ts           — Env var + Supabase key validation
app/(app)/groups/[id]/ExpensesList.test.tsx     — Expense list rendering
app/(app)/groups/[id]/ActivityFeed.test.tsx     — Activity feed rendering
app/(app)/groups/[id]/useActivityLogs.test.ts   — Activity log hook
tests/smoke.test.ts                     — Production smoke tests (auth + API)
```

Run smoke tests after changing: `proxy.ts`, auth routes, API routes, or env vars.

## Code Conventions
- TypeScript strict mode. No `any`.
- `async/await`, not `.then()`.
- Named exports (except Next.js page/layout defaults).
- Functional components with hooks. No classes.

## Reference Files
- **PLANNING.md** — Architecture decisions, design rationale, open questions. Consult before structural changes.
- **TODOS.md** — Completed work and prioritized backlog.

## Keeping Docs Current
After non-trivial tasks, update if warranted:
- **CLAUDE.md** — New patterns, structure changes, new env vars, inaccurate instructions.
- **PLANNING.md** — Architectural decisions made/changed, design questions resolved/raised.
- **TODOS.md** — Tasks completed, new tasks identified, status changes.
