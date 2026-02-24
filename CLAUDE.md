# Aviary — Expense Splitting App

Splitwise-style app: create groups, add expenses, get simplified debts. **Live production app with real users.** Security, correctness, and reliability are non-negotiable.

**Tech:** Next.js 16 (App Router, React 19, TS strict), Supabase (Auth + Data via JS client + RLS), Tailwind CSS 4, Zod 4, Vitest 4. Deployed on Vercel at `https://aviary.gregbigelow.com`.

## Design Philosophy

**Keep it simple and conventional.** Always prefer the standard, idiomatic way of doing things in Next.js, React, Supabase, and Tailwind. If a solution feels hacky or overly clever — stop. You're probably going down the wrong path. **Pause and ask the user** rather than pushing through a fragile workaround.

## Workflow

For any change: understand the code first, make changes, write tests, run tests, commit. **Tests pass before shipping. Every completed task ends with a local commit** — do NOT push to GitHub automatically. The user controls when to deploy by running `deploy` in their terminal.

**Starting a task:** Read **ARCHITECTURE.md** first — it covers data models, API routes, auth flow, and key design decisions. Use the "Where to Change Things" table below to find the right files. **Be strategic with token usage** — targeted reads, not broad exploration.

**If something goes sideways, STOP and re-plan.** Don't keep pushing through a broken approach — step back, reassess, and course-correct.

**Bug reports:** Just fix it. Investigate the root cause, write the fix, add tests, verify — zero hand-holding required. Don't ask clarifying questions when the bug is reproducible.

**Before marking anything done:** Run tests and verify correctness. `npm run build` must pass. Diff your changes and ask: "Would this hold up in code review?"

> **Database migrations must be pushed before the task is done.** If you created or modified a migration (schema change, RPC signature change, new function), run `npx supabase db push` as part of completing the task — not as an afterthought. A migration that exists only locally means the production app is broken.

> **Tests are non-negotiable.** Every bug fix, feature addition, and significant change must ship with tests. A task is not done until the tests are written and passing. No exceptions.

## Commands
```bash
npm run dev                             # Dev server (localhost:3000)
npm run build                           # Production build (next build)
SKIP_SMOKE_TESTS=1 npm test            # Fast: unit + integration only (no network)
npm test                                # All tests including smoke (hits production)
npm run db:types                        # Regenerate Supabase types → lib/supabase/database.types.ts
git push origin main                    # Deploy to production

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

## DRY: Don't Duplicate Business Logic
- **Balance/debt calculations** live in `lib/balances/` and are the single source of truth. **Never re-derive balances with a manual loop.** Use the pipeline: `buildRawDebts()` → `simplifyDebts()`. Convenience wrappers: `getUserDebtCents()` (how much a user owes), `getUserBalanceCents()` (signed net: positive=owed, negative=owes).
- **Money formatting** lives in `lib/format.ts` — `formatCents()`. Don't define local `formatCents` functions.
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

## Security Rules
- All API routes verify Supabase session server-side
- RLS policies enforce data access at the database layer (defense in depth)
- Zod validates all input at API boundaries
- No raw SQL with user input — Supabase parameterized queries only
- RPC functions are `SECURITY DEFINER` with `SET search_path = public`

## Testing

> **Hard rule: tests ship with the code.** Writing tests is part of the task — not a follow-up, not optional, not skippable. If you added or changed behavior and didn't write a test, the task is incomplete.

**Write tests for every bug fix and every new feature:**

- New UI behavior → co-located `*.test.tsx`
- New pure function → co-located `*.test.ts`
- New user-facing flow → Cypress spec in `cypress/e2e/`
- New API route behavior → **prefer Cypress**; smoke tests are post-deploy health checks only

Cypress requires `npm run dev` running. Credentials in `cypress.env.json` (gitignored).

See **ARCHITECTURE.md § Testing** for patterns, mocking examples, and Cypress details.

## Visual Design Language

**Always use the `frontend-design` skill** when making UI/visual changes.

**Brand personality:** Warm, friendly, a little poppy and fun. "Aviary" is a bird-themed expense splitting app — it should feel like hanging out with friends, not doing accounting. Approachable and cheerful, never corporate or sterile.

**Color system:**
- **Primary action color: Amber** (`amber-600` buttons, `amber-500` dark mode). This is the app's signature — warm, inviting, and energetic. Used for all primary CTAs, focus rings, and brand highlights.
- **Neutral warmth: Stone** (not gray). Use `stone-*` for text, borders, and surfaces to keep everything warm-toned. `stone-800` for dark text, `stone-200` for borders, `stone-50` for hover states.
- **Background:** `#faf9f7` (light — warm cream), `#0c0a09` (dark — warm charcoal). Never cool blue-toned.
- **Semantic colors:** Emerald for positive/lent, rose for owed/negative, red for danger/errors. These should feel natural alongside the warm palette.
- **Group identity colors:** 12 nature-named hues (honeycomb, teal tanager, iris, rosefinch, jay blue, forest warbler, terracotta, plum starling, kingfisher, ochre oriole, indigo bunting, cardinal). Used as subtle card tints with bold accent stripes. Adjacent groups must never share a color.

**Typography:**
- **Body/UI:** Geist Sans (`--font-sans`) — clean, modern, readable. Set via CSS variable, falls back to system-ui.
- **Logo/editorial:** Cormorant Garamond (`--font-serif-logo`, weight 400) — the "Aviary" wordmark in the nav and bird fact section. Gives editorial warmth. Don't overuse it.
- **Hierarchy:** `font-bold` + `tracking-tight` for headings, `font-semibold` for card titles, `font-medium` for labels. Generous size contrast between heading and body.

**Components:**
- **Buttons:** `amber-600` primary (warm and poppy), white/stone secondary, ghost for tertiary. `rounded-xl` for friendly softness. All have `active:scale-[0.97]` press feedback.
- **Inputs:** `rounded-xl` (auth pages) or `rounded-lg` (app forms), `border-stone-200`, `focus:ring-amber-500`. Amber focus ring ties to brand.
- **Cards:** `bg-white` / `dark:bg-stone-900`, `border-stone-200` / `dark:border-stone-800`. Soft shadow (`shadow-sm`). Hover: lift + shadow increase.
- **Modals:** Backdrop blur (`backdrop-blur-sm`), slide-up entrance animation, `rounded-2xl`.

**Motion:**
- Entrance: `slide-up` (0.2–0.4s, `ease-out`). Stagger with `animation-delay` for lists (80ms between items).
- Hover: `transition-all duration-200`. Lift (`-translate-y-0.5`) + shadow for cards. Scale for small interactive elements.
- Press: `active:scale-[0.97]` on buttons for tactile feedback.
- Keep motion subtle and purposeful — it should feel alive, not distracting.

**Dark mode:** All components must support `dark:` variants. Dark surfaces use `stone-900`/`stone-950` (warm), not cold `gray-*`. Text in dark mode: `stone-200`/`stone-300`.

## Code Conventions
- TypeScript strict. No `any`. `async/await`, not `.then()`.
- Named exports (except Next.js page/layout defaults).
- Functional components with hooks. No classes.
- Server Components by default. `"use client"` only for interactivity.

## Environment Variables
All in `.env.local` (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `NEXT_PUBLIC_SITE_URL` — `https://aviary.gregbigelow.com` in prod, `http://localhost:3000` in dev
- `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` — (optional) Test account for smoke tests + Cypress

## Keeping Docs Current
After non-trivial tasks, update if warranted:
- **CLAUDE.md** — Workflow changes, new gotchas, structure changes
- **ARCHITECTURE.md** — Design decisions, new patterns, data flow details
