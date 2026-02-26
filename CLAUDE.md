# Aviary — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. **Live production app with real users.** Security, correctness, and reliability are non-negotiable.

**Tech:** Next.js 16 (App Router, React 19, TS strict), Supabase (Auth + Data via JS client + RLS), Tailwind CSS 4, Zod 4, Vitest 4. React Native mobile app (Expo SDK 52, Expo Router v4, NativeWind v4, TanStack Query v5). Monorepo with `@aviary/shared` for cross-platform business logic. Deployed on Vercel at `https://aviary.gregbigelow.com`.

## Design Philosophy

**Keep it simple and conventional.** Always prefer the standard, idiomatic way of doing things in Next.js, React, Supabase, and Tailwind. If a solution feels hacky or overly clever — stop. You're probably going down the wrong path. **Pause and ask the user** rather than pushing through a fragile workaround.

## Workflow

**`origin/main` is the canonical source of truth.** All work ultimately lands on `origin/main`. Local `main` is just a local cache.

### Default workflow
1. Pull latest before starting: `git pull --rebase origin main`
2. Make changes and write tests
3. Verify: `npx tsc --noEmit && SKIP_SMOKE_TESTS=1 npm test`
4. Commit to local `main`
5. `git push origin main` — triggers a Vercel **preview deployment** automatically
6. User promotes to production when satisfied: `deploy` (shell shortcut) or `vercel --prod`

### Worker instances
Workers are Claude instances spawned with the worker prompt (`~/.claude/prompts/worker.md`). They follow a different loop: branch from `origin/main`, implement, get subagent review, push directly to `origin/main`. See that file for the full flow.

**Don't commit during planning.** Only commit actual deliverable work — features, bug fixes, doc updates tied to code. Exploring or drafting a plan doesn't warrant a commit.

**Starting a task:** Use the "Where to Change Things" table below to find the right files. For larger tasks or unfamiliar areas, consult **ARCHITECTURE.md** for data models, API routes, and design decisions. **Be strategic with token usage** — targeted reads, not broad exploration.

**If something goes sideways, STOP and re-plan.** Don't keep pushing through a broken approach — step back, reassess, and course-correct.

**Bug reports:** Just fix it. Investigate the root cause, write the fix, add tests, verify — zero hand-holding required. Don't ask clarifying questions when the bug is reproducible.

**Before committing:** Run `npx tsc --noEmit && SKIP_SMOKE_TESTS=1 npm test`. Diff your changes and ask: "Would this hold up in code review?"

> **Database migrations must be pushed before the task is done.** If you created or modified a migration (schema change, RPC signature change, new function), run `npx supabase db push` as part of completing the task — not as an afterthought. A migration that exists only locally means the production app is broken.

> **Tests are non-negotiable.** Every bug fix, feature addition, and significant change must ship with tests. A task is not done until the tests are written and passing. No exceptions.

## Commands
```bash
# Web app
npm run dev                             # Dev server (localhost:3000)
npm run build                           # Production build (next build)
SKIP_SMOKE_TESTS=1 npm test            # Fast: unit + integration only (no network)
npm test                                # All tests including smoke (hits production)
npm run db:types                        # Regenerate Supabase types → lib/supabase/database.types.ts
git push origin main                    # Triggers a Preview deployment on Vercel (NOT production)
vercel --prod                           # Deploy current build to production
vercel promote <preview-url>            # Promote an existing preview to production (no rebuild)

# Mobile app
cd mobile && npx expo start            # Start Expo dev server
cd mobile && npm test                  # Run mobile tests
cd mobile && npm run typecheck         # Type-check mobile code

# Shared package
# No build step — consumed as raw TS via transpilePackages (web) and Metro (mobile)

# Database migrations
npx supabase db push                    # Apply migrations in supabase/migrations/
npx supabase migration new <name>       # Create new migration file

# E2E tests (requires npm run dev in another terminal)
npm run cy:open                         # Cypress interactive GUI
npm run cy:run                          # Cypress headless
```

## Where to Change Things

| To change... | Look at... |
|---|---|
| **Auth flow** (login, signup, session) | `app/(auth)/login/`, `app/(auth)/signup/`, `app/auth/callback/route.ts`, `proxy.ts`, `lib/supabase/server.ts` |
| **Dashboard** (group list, create group) | `app/(app)/dashboard/page.tsx`, `CreateGroupButton.tsx` |
| **Group detail page** (layout, data fetching) | `app/(app)/groups/[id]/page.tsx` (server component — fetches all data) |
| **Expenses** (list, add, edit, delete) | `ExpensesList.tsx`, `AddExpenseForm.tsx`, `ExpenseDetailModal.tsx` (all in `app/(app)/groups/[id]/`) |
| **Activity feed** | `ActivityFeed.tsx`, `useActivityLogs.ts` (in `app/(app)/groups/[id]/`) |
| **Members** (add/list/leave) | `AddMemberForm.tsx`, `LeaveGroupButton.tsx` (in `app/(app)/groups/[id]/`), `app/api/groups/[id]/members/route.ts` |
| **Invite links** | `CopyInviteLinkButton.tsx`, `app/(app)/invite/[token]/page.tsx`, `InviteJoinForm.tsx`, `app/api/invite/[token]/join/route.ts` |
| **Settings / account deletion** | `app/(app)/settings/page.tsx`, `SettingsClient.tsx`, `app/api/account/route.ts` |
| **Balance/debt calculation** | `lib/balances/` — `buildRawDebts.ts`, `simplify.ts`, `getUserDebt.ts`, `splitAmount.ts` (pure functions, zero deps, 150+ tests) |
| **Money formatting** | `lib/format.ts` — `formatCents()` (single source of truth for `$X.XX` display) |
| **Display name formatting** | `lib/formatDisplayName.ts` — abbreviates "First Last" → "First L." |
| **API routes** | `app/api/groups/` — see ARCHITECTURE.md for full route reference |
| **Database schema / RLS / RPC** | `supabase/migrations/`, then `npx supabase db push` + `npm run db:types` |
| **Supabase types** | `lib/supabase/database.types.ts` (auto-generated, don't edit manually) |
| **Shared UI components** | `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx` |
| **Nav bar** | `components/Nav.tsx` |
| **Auth middleware** (route protection) | `proxy.ts` (**not** `middleware.ts` — Next.js 16 convention) |
| **Styling / dark mode** | Tailwind `dark:` variants; globals in `app/globals.css` |
| **E2E tests** | `cypress/e2e/` — specs; `cypress/support/commands.ts` — `cy.login()` |
| **Friends** (friend expenses, dashboard) | `DashboardAddExpenseForm.tsx` (dashboard), `app/api/friends/expenses/route.ts` (API), `mobile/lib/queries/friends.ts` + `contacts.ts` (mobile hooks), group detail conditional rendering via `isFriendGroup` |
| **Shared business logic** | `packages/shared/src/` — source of truth; `lib/` files are re-export barrels for web |
| **Mobile app screens** | `mobile/app/` — Expo Router file-based routing (same convention as Next.js) |
| **Mobile data layer** | `mobile/lib/queries/` — TanStack Query hooks, direct-to-Supabase |
| **Mobile auth** | `mobile/lib/auth.tsx` (AuthProvider), `mobile/lib/supabase.ts` (SecureStore client) |
| **Mobile UI components** | `mobile/components/ui/` — Button, Card, Input, Avatar, MemberPill, etc. |
| **Mobile tests** | Co-located `*.test.tsx` files; see `mobile/TESTING.md` for patterns and mocks |

## DRY: Don't Duplicate Business Logic
- **All pure business logic lives in `@aviary/shared`** (`packages/shared/src/`). Web `lib/` files are thin re-export barrels. Mobile imports via `mobile/lib/queries/shared.ts`. Never put new pure logic directly in `lib/` or `mobile/lib/` — add it to the shared package.
- **Balance/debt calculations**: `buildRawDebts()` → `simplifyDebts()`. Convenience wrappers: `getUserDebtCents()`, `getUserBalanceCents()`. **Never re-derive balances with a manual loop.**
- **Money formatting**: `formatCents()` from `@aviary/shared`. Don't define local `formatCents` functions.
- **Validation schemas**: Zod schemas in `@aviary/shared/validation.ts`. Both web API routes and mobile use the same schemas.
- **RPC param builders**: `buildCreateExpenseParams()`, etc. in `@aviary/shared/rpcParams.ts`. Mobile must use these to construct RPC payloads — never build RPC params inline.
- **Unknown user fallback** is `"Unknown"` everywhere. Don't use `"Deleted User"` or other variants.
- When the same rule exists in both JS and an RPC function (e.g., "user can't leave with outstanding debt"), keep them in sync. The JS utility is the client-side source of truth; the RPC is the server-side safety net.

## Critical Gotchas

1. **`params` is a Promise** in Next.js 16: `const { id } = await params`
2. **Auth middleware is `proxy.ts`**, not `middleware.ts`
3. **Never use `NEXT_PUBLIC_SITE_URL` in client-side `fetch()`** — causes CORS bugs. Use root-relative paths: `fetch(\`/api/...\`)`
4. **Money is always integers (cents).** Never floats. Display formatting converts at UI layer via `formatCents()`.
5. **Supabase returns dates as ISO strings**, not `Date` objects. Use `.split("T")[0]` for YYYY-MM-DD.
6. **Supabase relation names match table names**: `expense.User` (not `expense.paidBy`), `expense.ExpenseSplit` (not `expense.splits`).
7. **Atomic mutations use RPC functions** (`create_expense`, `update_expense`, `delete_expense`, `create_group`, `create_payment`). These are `SECURITY DEFINER` PL/pgSQL functions that bypass RLS and do their own auth checks.
8. **RLS is enabled on all 6 tables.** The `is_group_member()` helper checks membership via `auth.uid()`.
9. **RPC function migrations must DROP then CREATE** — `CREATE OR REPLACE` only works if the parameter signature is identical. Changing params without dropping first creates stale overloads.
10. **Views must set `security_invoker = true`** — Postgres defaults views to SECURITY DEFINER (runs as view owner, bypassing RLS). Always add `WITH (security_invoker = true)` when creating views, or they silently expose data to anyone with SELECT access.

### Mobile-Specific Gotchas
11. **Mobile calls Supabase directly** — no API intermediary. Mutations use `supabase.rpc()` with shared RPC param builders. Queries use the Supabase JS client with RLS.
12. **Mobile auth uses SecureStore** — session tokens stored in encrypted on-device storage via `expo-secure-store`. `detectSessionInUrl: false` in the Supabase client config.
13. **`MemberColor` is platform-specific** — web uses `{ bg: string; text: string }` (Tailwind classes), mobile uses string union `"rose" | "sky" | ...`. The `Member` type is also platform-specific. Don't move these to `@aviary/shared`.
14. **Mobile tests run separately** — `cd mobile && npm test`. Root vitest config excludes `mobile/**`. See `mobile/TESTING.md` for mock architecture and patterns.
15. **`add_member_by_email` RPC** — mobile uses this instead of the web's `POST /api/groups/[id]/members` route. Atomic: auth check → user lookup → duplicate check → insert.

## Security Rules
- All API routes verify Supabase session server-side
- RLS policies enforce data access at the database layer (defense in depth)
- Zod validates all input at API boundaries
- No raw SQL with user input — Supabase parameterized queries only
- RPC functions are `SECURITY DEFINER` with `SET search_path = public`

## Testing

**Write tests for every bug fix and every new feature:**

- New UI behavior → co-located `*.test.tsx`
- New pure function → co-located `*.test.ts`
- New user-facing flow → Cypress spec in `cypress/e2e/`
- New API route behavior → **prefer Cypress**; smoke tests are post-deploy health checks only

Cypress requires `npm run dev` running. Credentials in `cypress.env.json` (gitignored).

See **ARCHITECTURE.md § Testing** for patterns, mocking examples, and Cypress details. For mobile testing, see **mobile/TESTING.md**.

**Testing gotchas (happy-dom):**
- `fireEvent.submit(form)` not `fireEvent.click(button)` for form submissions
- Wrap async handlers in `await act(async () => {...})`
- `afterEach(cleanup)` is required — DOM persists across tests

**Visual design:** See **DESIGN.md** for the full design language (colors, typography, components, motion). **Always use the `frontend-design` skill** when making UI/visual changes.

## Code Conventions
- TypeScript strict. No `any`. `async/await`, not `.then()`.
- Named exports (except Next.js page/layout defaults).
- Functional components with hooks. No classes.
- Server Components by default. `"use client"` only for interactivity.

## Environment Variables
All in `.env.local` (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `NEXT_PUBLIC_SITE_URL` — `https://aviary.gregbigelow.com` in prod and dev. Not set in Vercel Preview — code falls back to `VERCEL_URL` / `NEXT_PUBLIC_VERCEL_URL` automatically.
- `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` — (optional) Test account for smoke tests + Cypress

## Keeping Docs Current

**This is important.** ARCHITECTURE.md is the map that lets future sessions navigate the codebase efficiently instead of reading 50+ files. If you add a new feature, table, API route, component, or shared utility — update ARCHITECTURE.md so the next session doesn't have to rediscover it.

After non-trivial tasks, update if warranted:
- **ARCHITECTURE.md** — New data models, API routes, components, shared logic, design decisions. This is the primary reference — keep it complete. Key sections to maintain: Project Structure, Data Models, API Routes, Component Hierarchy, Shared Pure Logic table, Additional Features table.
- **CLAUDE.md** — Workflow changes, new gotchas, new "Where to Change Things" entries, new commands
