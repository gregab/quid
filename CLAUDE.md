# Quid — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. **Live production app with real users.** Security, correctness, and reliability are non-negotiable.

**Tech:** Next.js 16 (App Router, React 19, TS strict), Prisma 7, Supabase Auth, Tailwind CSS 4, Zod 4, Vitest 4. Deployed on Vercel at `https://gregbigelow.com/quid`.

## Workflow

For any change: understand the code first, make changes, write tests, run tests, commit, push. **Tests pass before shipping. Every completed task ends with a commit and push** (`git push origin main` → Vercel auto-deploys). This applies to all changes — UI, copy, styling, refactors, bug fixes. Don't wait to be asked.

## Commands
```bash
npm run dev                             # Dev server (localhost:3000/quid)
npm run build                           # Production build (prisma generate + next build)
SKIP_SMOKE_TESTS=1 npm test            # Fast: unit + integration only (no network)
npm test                                # All tests including smoke (hits production)
npx prisma migrate dev                  # Run migrations
npx prisma generate                     # Regenerate client → app/generated/prisma/
git push origin main                    # Deploy to production
vercel logs --follow                    # Stream live production logs
```

## Where to Change Things

| To change... | Look at... |
|---|---|
| **Auth flow** (login, signup, session) | `app/(auth)/login/`, `app/(auth)/signup/`, `app/auth/callback/route.ts`, `proxy.ts`, `lib/supabase/server.ts` |
| **Dashboard** (group list, create group) | `app/(app)/dashboard/page.tsx`, `CreateGroupButton.tsx` |
| **Group detail page** (layout, data fetching) | `app/(app)/groups/[id]/page.tsx` (server component — fetches all data) |
| **Expenses** (list, add, edit, delete) | `ExpensesList.tsx`, `AddExpenseForm.tsx`, `ExpenseActions.tsx` (all in `app/(app)/groups/[id]/`) |
| **Activity feed** | `ActivityFeed.tsx`, `useActivityLogs.ts` (in `app/(app)/groups/[id]/`) |
| **Members** (add/list) | `AddMemberForm.tsx` (in `app/(app)/groups/[id]/`), `app/api/groups/[id]/members/route.ts` |
| **Balance/debt calculation** | `lib/balances/simplify.ts` (pure function, zero deps, 14 tests) |
| **API routes** | `app/api/groups/` — see ARCHITECTURE.md for full route reference |
| **Database schema** | `prisma/schema.prisma` (6 models), then `npx prisma migrate dev` |
| **Database connection** | `lib/prisma/client.ts` (singleton, SSL config, adapter pattern) |
| **Shared UI components** | `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx` |
| **Nav bar** | `components/Nav.tsx` |
| **Auth middleware** (route protection) | `proxy.ts` (**not** `middleware.ts` — Next.js 16 convention) |
| **Styling / dark mode** | Tailwind classes with `dark:` variants; globals in `app/globals.css` |

## Critical Gotchas

1. **`params` is a Promise** in Next.js 16: `const { id } = await params`
2. **Auth middleware is `proxy.ts`**, not `middleware.ts`
3. **Never use `NEXT_PUBLIC_SITE_URL` in client-side `fetch()`** — causes CORS bugs. Use root-relative paths: `fetch(\`/quid/api/...\`)`
4. **Money is always integers (cents).** Never floats. Display formatting converts at UI layer.
5. **Prisma import**: `import { prisma } from "@/lib/prisma/client"` (named export)
6. **Auth = Supabase, Data = Prisma.** Never query data through Supabase JS client.

## Security Rules
- SSL cert verification always enabled (`rejectUnauthorized: true`)
- All API routes verify Supabase session server-side
- All queries scope to authenticated user's groups (never return other users' data)
- Zod validates all input at API boundaries
- No raw SQL with user input — Prisma parameterized queries only

## Testing

**Write tests for every bug fix and every new feature.** A bug fix without a test can regress silently. A new feature without a test has no documented contract.

```
lib/balances/simplify.test.ts                   — unit tests (debt simplification)
lib/supabase/supabase.test.ts                   — env var + Supabase key validation
app/(app)/groups/[id]/ExpensesList.test.tsx      — expense list rendering + interactions
app/(app)/groups/[id]/ActivityFeed.test.tsx      — activity feed rendering
app/(app)/groups/[id]/useActivityLogs.test.ts    — activity log hook
tests/smoke.test.ts                              — production smoke tests (auth + API)
```

**Where to add tests:**
- New UI behavior or rendering logic → add to the relevant `*.test.tsx` co-located with the component
- New pure function → co-locate a `*.test.ts` next to it
- New API route behavior → smoke test if it can't be covered by unit/integration tests

Run smoke tests after changing: `proxy.ts`, auth routes, API routes, or env vars.

See **ARCHITECTURE.md § Testing** for patterns, mocking examples, and gotchas.

## Code Conventions
- TypeScript strict. No `any`. `async/await`, not `.then()`.
- Named exports (except Next.js page/layout defaults).
- Functional components with hooks. No classes.
- Server Components by default. `"use client"` only for interactivity.

## Environment Variables
All in `.env.local` (see `.env.local.example`):
- `DATABASE_URL` — Direct (non-pooled) Supabase Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `NEXT_PUBLIC_SITE_URL` — `https://gregbigelow.com/quid` in prod, `http://localhost:3000/quid` in dev
- `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` — (optional) Test account for authenticated smoke tests

## Reference Docs
- **ARCHITECTURE.md** — How everything works: data models, API details, auth flow, patterns, design decisions. Read this to understand the codebase deeply.
- **TODOS.md** — What's done and what's in the backlog.

## Keeping Docs Current
After non-trivial tasks, update if warranted:
- **CLAUDE.md** — Workflow changes, new gotchas, structure changes.
- **ARCHITECTURE.md** — Design decisions, new patterns, implementation details.
- **TODOS.md** — Tasks completed, new tasks identified.
