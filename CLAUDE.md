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

**Brand identity:** Warm, naturalist, bird-themed. The app is called "Aviary" — it should feel like a well-designed nature journal meets modern fintech. Approachable, not corporate.

**Color system:**
- **Primary accent:** Amber/stone warm tones (`amber-600`, `stone-800`). Used for CTAs, active states, brand elements.
- **Background:** `#f8f9fc` (light), `#0a0a0f` (dark). Not pure white/black — slightly warm.
- **Group identity colors:** Each group gets a unique color from a 12-palette set of nature-inspired hues (honeycomb, teal, iris, rosefinch, jay blue, forest, terracotta, plum, kingfisher, ochre, indigo, cardinal). Used for card backgrounds (subtle tints) and accent stripes. Adjacent groups must never share a color.
- **Surfaces:** Cards use `bg-white` / `dark:bg-gray-800` with `border-gray-200` / `dark:border-gray-700`. Rounded corners: `rounded-xl` for cards, `rounded-2xl` for larger containers, `rounded-lg` for inputs/buttons.

**Typography:**
- **Body/UI:** Geist Sans (`--font-geist-sans`) — the system font for all functional text.
- **Logo/editorial:** Cormorant Garamond (`--font-serif-logo`, weight 400) — used only for the "Aviary" wordmark and the bird fact section. Gives an editorial, premium feel. Don't overuse it.
- **Hierarchy:** Bold (`font-bold`) for headings, `font-semibold` for card titles, `font-medium` for secondary labels. Use `tracking-tight` on headings.

**Components:**
- **Buttons:** `stone-800` primary, white secondary, ghost for tertiary. All have `active:scale-[0.97]` press feedback. Amber for warm CTAs (e.g., "Start a group").
- **Inputs:** `rounded-lg`, `border-gray-300`, `focus:ring-amber-500`. Amber focus ring ties to brand.
- **Cards:** Soft shadow (`shadow-sm`), subtle border. Hover: lift (`-translate-y-0.5`) + increased shadow. Keep it understated.
- **Modals:** Backdrop blur (`backdrop-blur-sm`), slide-up entrance animation, `rounded-2xl`.

**Motion:**
- Entrance animations: `slide-up` (0.2–0.4s, `ease-out`). Stagger with `animation-delay` for lists.
- Hover: `transition-all duration-200`. Lift + shadow for clickable cards. Scale for small interactive elements.
- Keep motion subtle and functional — no decorative animations.

**Dark mode:** All components must support `dark:` variants. Use Tailwind's `dark:` prefix consistently. Dark surfaces are gray-800/900, not pure black.

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
