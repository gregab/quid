# Quid — Architecture

Deep reference for how the app works. For workflow and commands, see CLAUDE.md.

## Project Structure

No `src/` directory — all code at repo root.

```
app/
  layout.tsx                             # Root layout: Geist fonts, metadata, dark mode class
  page.tsx                               # Root redirect: authed → /dashboard, else → /login
  globals.css                            # Tailwind base + custom animations (fade-in, slide-up, etc.)

  (auth)/                                # Route group: public auth pages
    login/page.tsx                       # Email/password login form (client component)
    signup/page.tsx                      # Signup form with "check your email" confirmation state (client)
  auth/callback/route.ts                 # GET handler: exchanges email confirmation code for session,
                                         #   upserts User in Prisma, redirects to /dashboard

  (app)/                                 # Route group: auth-protected pages
    layout.tsx                           # Auth guard (redirects to /login if no session), renders Nav,
                                         #   upserts User record from Supabase metadata on every request
    dashboard/
      page.tsx                           # Lists user's groups with deterministic emoji per group (server)
      CreateGroupButton.tsx              # "Create group" modal with name input (client)
    groups/[id]/
      page.tsx                           # Group detail: fetches members, expenses, splits, activity logs
                                         #   via Prisma; computes balances; renders server HTML then hands
                                         #   interactive sections to GroupInteractive
      GroupInteractive.tsx               # Client wrapper: manages expense state, computes
                                         #   optimistic balances, renders Balances section,
                                         #   ExpensesList, and ActivityFeed
      ExpensesList.tsx                   # Renders expense cards with optimistic add/edit/delete;
                                         #   manages pending state and animations
      AddExpenseForm.tsx                 # Modal: description, amount, date, payer dropdown,
                                         #   participant checkboxes; POSTs to expenses API
      ExpenseActions.tsx                 # Per-expense edit/delete: inline buttons, edit modal,
                                         #   delete confirmation dialog
      AddMemberForm.tsx                  # Modal: add member by email; POSTs to members API
      ActivityFeed.tsx                   # Renders activity log entries with relative timestamps
      useActivityLogs.ts                 # Hook: manages activity log state with optimistic additions
                                         #   and server reconciliation

  api/groups/
    route.ts                             # GET: list user's groups; POST: create group + auto-add creator
    [id]/
      members/route.ts                   # POST: add member by email (creates User if needed via upsert)
      expenses/route.ts                  # POST: create expense + equal splits + activity log (atomic)
      expenses/[expenseId]/route.ts      # PUT: edit expense + recalculate splits (atomic)
                                         # DELETE: delete expense + log (cascade handles splits)
      balances/route.ts                  # GET: compute simplified debts from expenses/splits

  generated/prisma/                      # Auto-generated Prisma client — never edit

components/
  Nav.tsx                                # Top nav: app name, user display name, logout button (client)
  ui/Button.tsx                          # Button component with variant props (primary, secondary, danger)
  ui/Card.tsx                            # Card container with consistent padding/border
  ui/Input.tsx                           # Input with label, error message, full-width styling

lib/
  prisma/client.ts                       # Prisma singleton: creates pg.Pool with SSL (bundled Supabase
                                         #   Root CA cert), strips sslmode from connection string,
                                         #   passes pool to PrismaPg adapter
  supabase/client.ts                     # Browser Supabase client (createBrowserClient)
  supabase/server.ts                     # Server Supabase client (cookie-aware, for RSC + route handlers)
  balances/simplify.ts                   # Debt simplification: pure function, zero framework deps,
                                         #   greedy algorithm matching creditors ↔ debtors

prisma/schema.prisma                     # 6 models (see Data Models below)
proxy.ts                                 # Auth middleware (Next.js 16 uses proxy.ts, NOT middleware.ts)
next.config.ts                           # basePath: "/quid", turbopack config
```

## Data Models

All monetary values are **integers (cents)**. Never floats.

```
User
  id            String    @id @default(uuid())
  email         String    @unique
  displayName   String
  avatarUrl     String?
  createdAt     DateTime  @default(now())
  → has many: createdGroups, memberships, paidExpenses, splits, activityLogs

Group
  id            String    @id @default(uuid())
  name          String
  createdAt     DateTime  @default(now())
  createdById   String    → User
  → has many: members (GroupMember), expenses, activityLogs

GroupMember
  id            String    @id @default(uuid())
  groupId       String    → Group (cascade delete)
  userId        String    → User (cascade delete)
  joinedAt      DateTime  @default(now())
  @@unique([groupId, userId])

Expense
  id            String    @id @default(uuid())
  groupId       String    → Group (cascade delete)
  paidById      String    → User
  description   String
  amountCents   Int
  date          DateTime
  createdAt     DateTime  @default(now())
  → has many: splits (ExpenseSplit)

ExpenseSplit
  id            String    @id @default(uuid())
  expenseId     String    → Expense (cascade delete)
  userId        String    → User
  amountCents   Int

ActivityLog
  id            String    @id @default(uuid())
  groupId       String    → Group (cascade delete)
  actorId       String    → User
  action        String    // "expense_added" | "expense_edited" | "expense_deleted"
  payload       Json      // See "Activity Log System" section below for full payload shape
  createdAt     DateTime  @default(now())
```

**Cascade behavior:** Deleting a Group cascades to GroupMember, Expense, and ActivityLog. Deleting an Expense cascades to ExpenseSplit. Deleting a User cascades to GroupMember only (expenses and activity logs retain the reference).

## API Routes

All return `{ data, error }` JSON. All require a valid Supabase session (401 without). All group-scoped routes verify the user is a member (403 otherwise).

### `GET /api/groups`
Returns groups the authenticated user is a member of, with member count.

### `POST /api/groups`
Creates a group and auto-adds the creator as a member.
- Body: `{ name: string }`
- Returns: 201 with created group

### `POST /api/groups/[id]/members`
Adds a member by email. If the user doesn't exist in Prisma yet (hasn't signed up), this will fail — the target must have an account.
- Body: `{ email: string }`
- Returns: 201, or 409 if already a member, 404 if user not found

### `POST /api/groups/[id]/expenses`
Creates an expense with equal split among participants. Atomic transaction: creates Expense + ExpenseSplit records + ActivityLog entry.
- Body: `{ description: string, amountCents: number, date: "YYYY-MM-DD", paidById?: string, participantIds?: string[] }`
- Defaults: `paidById` = current user, `participantIds` = all group members
- Split logic: equal division, remainder cents distributed 1 at a time to first N participants

### `PUT /api/groups/[id]/expenses/[expenseId]`
Edits an expense and recalculates all splits atomically. Deletes old splits, creates new ones.
- Body: same shape as POST
- Any group member can edit any expense

### `DELETE /api/groups/[id]/expenses/[expenseId]`
Deletes an expense. Cascade delete handles splits. Creates an ActivityLog entry.
- Any group member can delete any expense

### `GET /api/groups/[id]/balances`
Computes simplified debts from all expenses and splits in the group. Uses the greedy algorithm in `lib/balances/simplify.ts`.
- Returns: `{ data: [{ fromId, fromName, toId, toName, amountCents }] }`

## Data Flow

```
Browser → proxy.ts (auth check) → Page or Route Handler
                                        ↓
                                Supabase server client (get session from cookies)
                                        ↓
                                Prisma (query/mutate PostgreSQL)
```

**Server-rendered pages** (dashboard, group detail): The server component fetches all needed data via Prisma in a single render pass, returns HTML. Interactive parts are wrapped in client components that receive server data as props.

**Mutations** (add/edit/delete expense, add member, create group): Client component → `fetch()` to API route → Zod validates input → Prisma mutates in transaction → JSON response. Client applies optimistic update before the fetch completes.

**Balances**: Computed on-demand from raw expense/split data. No stored balance table — always derived from source of truth.

## Auth System

### Flow
1. **Signup**: User submits email + password → Supabase sends confirmation email with `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback` → signup page shows "check your email" (no redirect)
2. **Email confirmation**: User clicks link → `auth/callback/route.ts` exchanges code for session, upserts User in Prisma (from Supabase metadata), redirects to `/dashboard`
3. **Login**: Email/password → Supabase creates session cookie → redirect to `/dashboard`
4. **Route protection**: `proxy.ts` intercepts all requests. Protected paths (`/dashboard`, `/groups/*`, `/settings`) redirect to `/login` without session. Auth paths (`/login`, `/signup`) redirect to `/dashboard` with session.
5. **User upsert**: `(app)/layout.tsx` upserts the Prisma User record on every authenticated page load, ensuring Supabase auth users always exist in the app database.

### Supabase configuration
- Site URL in Supabase dashboard: `https://gregbigelow.com/quid`
- Redirect allowlist must include the callback URL
- Sessions are stored in HTTP-only cookies via `@supabase/ssr`

## Client-Side Patterns

### Optimistic Updates
The expense list, activity feed, and balances all use optimistic updates:

1. User triggers action (add/edit/delete expense)
2. Client immediately updates local state with `isPending: true` flag
3. API request fires in background
4. **Success**: `router.refresh()` triggers server re-render, replacing optimistic state with real data
5. **Failure**: `router.refresh()` reverts to server state

Pending items render with fade animations. The `isPending` flag prevents user interaction with in-flight items.

**Key files**: `ExpensesList.tsx` manages expense optimistic state and fires `onExpensesChange` callback after every state update. `GroupInteractive.tsx` holds `balancesExpenses` state (kept in sync via that callback) and recomputes simplified debts with `useMemo` — so balances update synchronously with expense changes, before the server responds. `useActivityLogs.ts` manages activity log optimistic state.

**Client-side balance computation:** `GroupInteractive` replicates the server's equal-split formula (`base = floor(amountCents / n)`, remainder distributed 1 cent at a time to first N participants) to derive raw debts from `ExpenseRow[]`, then passes them through `simplifyDebts`. The result is approximate for existing expenses (split order may differ from DB creation order) but corrects to authoritative values after `router.refresh()`.

### Component Hierarchy (Group Detail Page)
```
page.tsx (server)                    ← Fetches all data via Prisma
  └─ GroupInteractive (client)       ← Manages expense, activity, and balance state
       ├─ Balances section           ← Client-rendered; recomputes on every expense change
       ├─ ExpensesList               ← Renders expenses with optimistic updates
       │    ├─ AddExpenseForm        ← Modal for new expenses
       │    └─ ExpenseActions (×N)   ← Edit/delete per expense
       └─ ActivityFeed               ← Renders activity log
  └─ AddMemberForm (client)          ← Separate: manages its own state
  └─ Members list (server HTML)      ← Static render of group members
```

### Client-Side fetch Pattern
**Never use `NEXT_PUBLIC_SITE_URL` in `fetch()` calls.** This hardcodes the domain and causes CORS failures when Vercel serves from `www.` vs non-`www.` (this bug has happened twice). Instead, derive a root-relative basePath:

```ts
const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
// → "/quid"
fetch(`${basePath}/api/groups/...`, { method: "POST", ... });
```

## Database Connection

`lib/prisma/client.ts` handles two Supabase-specific issues:

1. **SSL certificate**: Supabase uses a private root CA not in system trust stores. The file bundles the Supabase Root CA cert as an inline constant and passes it via `ssl: { rejectUnauthorized: true, ca: SUPABASE_ROOT_CA }`. Never set `rejectUnauthorized: false`.

2. **Connection string sslmode**: `pg-connection-string` misparses `sslmode=require` from the DATABASE_URL, overriding the `ssl` config. We strip it with `url.searchParams.delete("sslmode")` before creating the pool.

The Prisma client is a module-level singleton. It creates a `pg.Pool` and passes it to `@prisma/adapter-pg` (Prisma 7's driver adapter pattern).

## Expense Splitting

**Equal split** (currently the only mode):
- Total ÷ number of participants = base amount per person
- Remainder (amountCents % participantCount) is distributed 1 cent at a time to the first N participants
- Guarantees splits always sum to exactly the expense total

**Atomic creation**: Every expense mutation (create, edit, delete) runs inside `prisma.$transaction()`, which handles the expense record, all split records, and the activity log entry in a single database transaction.

**Payer selection**: The expense creator can choose any group member as the payer (defaults to self). Participant filtering lets you exclude members from the split.

## Activity Log System

The activity log records every expense mutation (add, edit, delete) with enough data to render a human-readable description without additional DB queries.

### Files involved
| File | Role |
|---|---|
| `app/api/groups/[id]/expenses/route.ts` | Creates `expense_added` log inside the expense creation transaction |
| `app/api/groups/[id]/expenses/[expenseId]/route.ts` | Creates `expense_edited` and `expense_deleted` logs |
| `app/(app)/groups/[id]/ActivityFeed.tsx` | Renders logs; contains `buildEditInfo()` for rich edit descriptions |
| `app/(app)/groups/[id]/useActivityLogs.ts` | Hook: manages optimistic log state and server reconciliation |
| `app/(app)/groups/[id]/ExpenseActions.tsx` | Computes and fires optimistic activity log entry on edit/delete |
| `app/(app)/groups/[id]/GroupInteractive.tsx` | Wires `useActivityLogs` to both `ExpensesList` and `ActivityFeed` |

### Payload shapes

**`expense_added`** and **`expense_deleted`**:
```json
{ "description": "Dinner", "amountCents": 3000, "paidByDisplayName": "Alice" }
```

**`expense_edited`** (current format):
```json
{
  "description": "Dinner",
  "amountCents": 3000,
  "paidByDisplayName": "Alice",
  "changes": {
    "amount":       { "from": 2500, "to": 3000 },
    "date":         { "from": "2024-01-05", "to": "2024-01-06" },
    "description":  { "from": "Old Name", "to": "New Name" },
    "paidBy":       { "from": "Bob", "to": "Alice" },
    "participants": { "added": ["Greg", "Alex"], "removed": ["Bob"] }
  }
}
```
Only the keys that actually changed are present. An empty `changes` object means nothing detectably changed. Old logs (before the `changes` key was added) have no `changes` field — `buildEditInfo()` handles this via backward-compat branch that checks `previousAmountCents`.

### How edit logs are built in the API (PUT handler)
The PUT handler fetches the expense with `paidBy`, `splits` (with user display names), and `group.members`. After parsing the request body and resolving new values, it compares old vs new fields to build the `changes` object, then writes it in the atomic transaction. Key detail: `expense.date` comes from Prisma as a `Date` object — convert to `"YYYY-MM-DD"` with `expense.date.toISOString().split("T")[0]` before comparing.

### How edit logs are built optimistically in the client (ExpenseActions)
`handleEdit()` in `ExpenseActions.tsx` computes the same `changes` object client-side by comparing the current `expense` prop against the form state. It uses `members` (the Member[] prop) to look up display names for participant ID diffs. Note: `expense.participantIds` can be empty when all members participate — use the same default logic as the form's initial state (`expense.participantIds.length > 0 ? expense.participantIds : members.map(m => m.userId)`).

### Rendering (ActivityFeed)
`buildEditInfo(payload)` returns `{ verbAndPrep, showExpenseName, detail }`:
- **Single participant add**: `"added Greg to"` (preposition "to")
- **Single participant remove**: `"removed Bob from"` (preposition "from")
- **Mixed add+remove or any other combination**: preposition "on"
- **Rename only**: `verbAndPrep = "renamed"`, `showExpenseName = false`, detail shows `"Old → New"`
- **Multiple change types**: joined with `" and "` → `"changed the price and changed the date on"`
- **No `changes` key (old logs)**: falls back to `"edited"` with old `previousAmountCents` logic

### Prisma JSON type gotcha
When writing to a `Json` field in Prisma, `Record<string, unknown>` is **not** assignable to `InputJsonValue`. Use a specific typed struct (all leaf values must be `string | number | boolean | string[] | ...`). See the `changes` variable in `expenses/[expenseId]/route.ts` for the pattern.

## Design Decisions

### Why Prisma + Supabase (not just Supabase client)?
Supabase JS couples you to their query API. Prisma is a standard ORM — if we migrate off Supabase hosting, only the connection string changes. **Rule: Auth = Supabase, Data = Prisma.**

### Why `proxy.ts`?
Next.js 16 renamed middleware to `proxy.ts`. We confirmed `middleware.ts` doesn't work.

### Why `basePath: "/quid"`?
App lives at `gregbigelow.com/quid`, not domain root. Vercel's basePath handles internal routing. External services (email redirects) need full URLs via `NEXT_PUBLIC_SITE_URL`.

### Why cents for money?
`0.1 + 0.2 !== 0.3`. Integers avoid floating point errors entirely.

### Why resource-oriented API routes?
Future mobile client should reuse the same API. `/api/groups/[id]/expenses` works for any client.

### Why generated Prisma client in `app/generated/prisma/`?
Default output in `node_modules` gets wiped on install. This location is persistent and importable.

### Edit/delete permissions
Any group member can edit or delete any expense. Chosen for simplicity. Revisit if users report problems.

### Settle up (not yet implemented)
Plan: Record settlements as special expenses (description = "Settlement", single split to creditor). Uses existing infrastructure, no schema migration needed.

### Group deletion (not yet implemented)
Plan: Hard delete. Cascade deletes handle all cleanup. No soft delete until audit trail is needed.

### Member removal (not yet implemented)
Plan: Block removal if member has non-zero balance. Self-removal allowed if debts are settled.

## Testing

**Stack:** Vitest 4 + `@testing-library/react` 16 + happy-dom. No `@testing-library/user-event` — use `fireEvent` for interactions.

### File conventions
- Component tests: `ComponentName.test.tsx` co-located with the component
- Hook/utility tests: `name.test.ts` co-located with the source file
- Smoke tests: `tests/smoke.test.ts` (hits live production)

### Test file boilerplate (component)
```tsx
// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

afterEach(cleanup); // required — DOM persists across tests otherwise
```

### Mocking `next/navigation`
All components that call `useRouter()` need this mock:
```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
```

### Mocking `fetch` for API calls
```ts
import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: {}, error: null }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### Form submission gotcha
**`fireEvent.click` on a submit button does NOT trigger `onSubmit` in happy-dom.** Use `fireEvent.submit` on the `<form>` element instead:
```ts
import { fireEvent, act } from "@testing-library/react";

const form = screen.getByRole("button", { name: /save/i }).closest("form")!;
await act(async () => {
  fireEvent.submit(form);
});
```
Wrap in `await act(async () => { ... })` when the handler is async (e.g. calls fetch) to flush all state updates.

### What to test
| Layer | Test what |
|---|---|
| Pure functions | All logic branches; use plain Vitest `describe/it/expect` |
| React components | Rendering, conditional display, class names for state flags, DOM order for lists |
| Optimistic updates | Use `rerender()` to simulate `router.refresh()` delivering new props |
| Interactions | `fireEvent.click` for buttons, `fireEvent.change` for inputs, `fireEvent.submit` for forms |
| API routes | Smoke tests for auth/routing concerns that can't be unit-tested |

### What NOT to test
- Implementation details (internal state, private functions)
- Styles/classnames beyond the minimum needed to verify behavior (e.g. `opacity-60` for pending state is fine)
- Things that are already covered by the framework (Next.js routing, Prisma query syntax)

### E2E Tests (Cypress)

**Stack:** Cypress 15 + TypeScript. Specs live in `cypress/e2e/`. Run against a local dev server.

**Setup:**
- `cypress.config.ts` — `baseUrl: http://localhost:3000/quid`, video off, 10 s command timeout
- `cypress/support/commands.ts` — `cy.login()` custom command
- `cypress/support/e2e.ts` — imports commands
- `cypress/tsconfig.json` — types: ["cypress"]
- `cypress.env.json` (gitignored) — `SMOKE_TEST_EMAIL` + `SMOKE_TEST_PASSWORD`

**`cy.login()` custom command:** Uses `cy.session()` to cache login between tests. On first call it visits `/login`, types the credentials from `cypress.env.json`, clicks "Sign in →", and waits for `/dashboard`. On subsequent calls in the same run, the session cookies are restored from cache — no re-login. If the validate function (visit /dashboard) fails, cy.session re-runs the setup.

**Test data strategy:** Tests create fresh data via `cy.request()` to the API in `beforeEach` blocks. Groups and expenses are named `[cypress] ...` with a `Date.now()` suffix for uniqueness. No cleanup — test data accumulates in the test account but doesn't affect correctness.

**Spec files:**
| File | What it covers |
|------|----------------|
| `cypress/e2e/auth.cy.ts` | Unauthenticated redirects, UI login/logout, invalid-credentials error |
| `cypress/e2e/dashboard.cy.ts` | Group list, create-group modal, basePath correctness on links |
| `cypress/e2e/group-detail.cy.ts` | Add/edit/delete expenses, activity feed, balances section |
| `cypress/e2e/navigation.cy.ts` | Nav bar, browser history back/forward, basePath 404 |

**Selectors:** Prefer existing `id` attributes (`#email`, `#expenseDescription`) and `aria-label` attributes (`[aria-label="Edit expense"]`) over brittle class selectors. All modals have `.modal-content` for scoping assertions.

**Running E2E tests:**
```bash
npm run dev                   # Start dev server first
npm run cy:open               # Interactive GUI
npm run cy:run                # Headless CI mode
```

## Open Questions

- **Dashboard balance cost**: Per-group net balance requires joining expenses+splits for each group. Fine for <50 groups/user, may need materialized balances later.
- **Expense categories**: Small predefined enum with "Other"? Or free-text tags?
- **Notifications**: Start with in-app toasts. Email notifications are a separate effort.
- **Mobile client**: Same API routes + CORS headers for cross-origin native apps.
- **Non-equal splits UI**: Per-person amount entry (not percentages). "Equal" default, "Custom" toggle.
