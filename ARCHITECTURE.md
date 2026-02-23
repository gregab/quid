# Aviary — Architecture

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
                                         #   upserts User via Supabase, redirects to /dashboard

  (app)/                                 # Route group: auth-protected pages
    layout.tsx                           # Auth guard (redirects to /login if no session), renders Nav,
                                         #   upserts User record from Supabase metadata on every request
    dashboard/
      page.tsx                           # Lists user's groups with deterministic emoji per group (server)
      CreateGroupButton.tsx              # "Create group" modal with name input (client)
    groups/[id]/
      page.tsx                           # Group detail: fetches members, expenses, splits, activity logs
                                         #   via Supabase; computes balances; renders server HTML then hands
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
      LeaveGroupButton.tsx               # Leave group: confirmation dialog, DELETE call, redirect
      ActivityFeed.tsx                   # Renders activity log entries with relative timestamps
      useActivityLogs.ts                 # Hook: manages activity log state with optimistic additions
                                         #   and server reconciliation
    settings/
      page.tsx                           # Settings page: fetches user info + group balances (server)
      SettingsClient.tsx                 # Account deletion with confirmation modal + balance warnings (client)

  api/account/
    route.ts                             # DELETE: delete account (RPC + admin auth user deletion)
  api/groups/
    route.ts                             # GET: list user's groups; POST: create group (via RPC)
    [id]/
      members/route.ts                   # POST: add member by email (creates User if needed via upsert)
      expenses/route.ts                  # POST: create expense + equal splits + activity log (via RPC)
      expenses/[expenseId]/route.ts      # PUT: edit expense + recalculate splits (via RPC)
                                         # DELETE: delete expense + log (via RPC)
      balances/route.ts                  # GET: compute simplified debts from expenses/splits

components/
  Nav.tsx                                # Top nav: app name, user display name, logout button (client)
  ui/Button.tsx                          # Button component with variant props (primary, secondary, danger)
  ui/Card.tsx                            # Card container with consistent padding/border
  ui/Input.tsx                           # Input with label, error message, full-width styling

lib/
  supabase/client.ts                     # Browser Supabase client (createBrowserClient<Database>)
  supabase/server.ts                     # Server Supabase client (cookie-aware, for RSC + route handlers)
  supabase/admin.ts                      # Server-only admin client (service role key, bypasses RLS)
  supabase/database.types.ts             # Auto-generated types from Supabase schema (run npm run db:types)
  balances/simplify.ts                   # Debt simplification: pure function, zero framework deps,
                                         #   greedy algorithm matching creditors ↔ debtors

supabase/
  migrations/                            # SQL migrations applied via `npx supabase db push`
  config.toml                            # Supabase CLI config (auto-generated by supabase init)

prisma/migrations/                       # Historical Prisma migrations (kept for reference)
proxy.ts                                 # Auth middleware (Next.js 16 uses proxy.ts, NOT middleware.ts)
next.config.ts                           # turbopack config
```

## Data Models

All monetary values are **integers (cents)**. Never floats. All `id` columns are `text` with `gen_random_uuid()::text` defaults.

```
User
  id            String    @id @default(uuid)
  email         String    @unique
  displayName   String
  avatarUrl     String?
  createdAt     DateTime  @default(now())

Group
  id            String    @id @default(uuid)
  name          String
  createdAt     DateTime  @default(now())
  createdById   String    → User

GroupMember
  id            String    @id @default(uuid)
  groupId       String    → Group (cascade delete)
  userId        String    → User (cascade delete)
  joinedAt      DateTime  @default(now())
  @@unique([groupId, userId])

Expense
  id            String    @id @default(uuid)
  groupId       String    → Group (cascade delete)
  paidById      String    → User
  description   String
  amountCents   Int
  date          DateTime
  createdAt     DateTime  @default(now())
  isPayment     Boolean   @default(false)   // true for payments recorded via Record Payment
  createdById   String?   → User            // set for payments; creator-only delete enforced in RPC

ExpenseSplit
  id            String    @id @default(uuid)
  expenseId     String    → Expense (cascade delete)
  userId        String    → User
  amountCents   Int

ActivityLog
  id            String    @id @default(uuid)
  groupId       String    → Group (cascade delete)
  actorId       String    → User
  action        String    // "expense_added" | "expense_edited" | "expense_deleted" | "member_left"
  payload       Json      // See "Activity Log System" section below for full payload shape
  createdAt     DateTime  @default(now())
```

**Cascade behavior:** Deleting a Group cascades to GroupMember, Expense, and ActivityLog. Deleting an Expense cascades to ExpenseSplit. Deleting a User cascades to GroupMember only (expenses and activity logs retain the reference).

## Data Access — Supabase JS Client + RLS

All data access goes through the Supabase JS client (`@supabase/supabase-js`). The same client instance used for auth is reused for data queries. Row Level Security (RLS) enforces authorization at the database layer.

### Query patterns

```ts
// Simple query with relation join
const { data } = await supabase
  .from("GroupMember")
  .select("*, User(*)")
  .eq("groupId", groupId);

// Disambiguated foreign key join (when table has multiple FKs to same table)
const { data } = await supabase
  .from("Expense")
  .select("*, User!paidById(*), ExpenseSplit(*)")
  .eq("groupId", id);

// Upsert (for User record on login/signup)
await supabase.from("User").upsert(
  { id: user.id, email, displayName },
  { onConflict: "id", ignoreDuplicates: true }
);

// Membership check
const { data } = await supabase
  .from("GroupMember")
  .select("id")
  .eq("groupId", groupId)
  .eq("userId", userId)
  .maybeSingle();
```

### Key differences from Prisma

| Prisma | Supabase |
|--------|----------|
| `expense.paidBy.displayName` | `expense.User.displayName` (relation = table name) |
| `member.user.displayName` | `member.User.displayName` |
| `expense.splits` | `expense.ExpenseSplit` |
| `expense.date.toISOString()` | `expense.date` (already a string) |
| `prisma.$transaction(...)` | `supabase.rpc("function_name", {...})` |
| `prisma.groupMember.findUnique({ where: { groupId_userId: {...} } })` | `.select("id").eq("groupId", x).eq("userId", y).maybeSingle()` |
| `orderBy: { group: { createdAt: "desc" } }` | Sort in JS after fetching (Supabase doesn't support ordering by joined relation) |

### RLS Policies

RLS is enabled on all 6 tables. A `SECURITY DEFINER` helper function `is_group_member(group_id)` checks membership using `auth.uid()` from the JWT.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **User** | Any authenticated user | Own record only | Own record only | — |
| **Group** | Members only | Any authenticated | — | — |
| **GroupMember** | Fellow group members | Group members | — | Self only (`userId = auth.uid()`) |
| **Expense** | Group members | Group members | Group members | Group members |
| **ExpenseSplit** | Via expense→group membership | Via expense→group membership | — | Via expense→group membership |
| **ActivityLog** | Group members | Group members | — | — |

### RPC Functions

7 `SECURITY DEFINER` PL/pgSQL functions handle atomic multi-table operations. They bypass RLS and do their own auth checks internally.

| Function | Purpose | Called from |
|----------|---------|------------|
| `create_group(_name)` | Creates group + adds creator as member | `POST /api/groups` |
| `create_expense(...)` | Creates expense + splits + activity log | `POST /api/groups/[id]/expenses` |
| `update_expense(...)` | Updates expense + replaces splits + activity log | `PUT /api/groups/[id]/expenses/[expenseId]` |
| `delete_expense(...)` | Activity log + deletes expense (cascade handles splits) | `DELETE /api/groups/[id]/expenses/[expenseId]` |
| `leave_group(_group_id)` | Verifies membership, blocks if |balance| > $2, deletes member row, logs `member_left`, deletes group if last member | `DELETE /api/groups/[id]/members` |
| `delete_account()` | Removes user from all groups (no balance check), logs departures, auto-deletes empty groups, deletes User row. Auth user deletion handled by API route via admin client. Orphaned expenses/activity logs retain their `paidById`/`actorId` references. | `DELETE /api/account` |
| `get_group_by_invite_token(_token)` | Returns `{ id, name, memberCount, isMember }` for invite preview; SECURITY DEFINER so non-members can read group name | `app/(app)/invite/[token]/page.tsx` (server component) |
| `join_group_by_token(_token)` | Adds caller as group member; idempotent; returns `{ groupId, alreadyMember }` | `POST /api/invite/[token]/join` |
| `create_payment(...)` | Creates payment expense + single split for recipient + activity log | `POST /api/groups/[id]/payments` |

Split computation (integer division + remainder distribution) is replicated in PL/pgSQL to match the JS logic exactly.

## API Routes

All return `{ data, error }` JSON. All require a valid Supabase session (401 without). All group-scoped routes verify the user is a member (403 otherwise).

### `GET /api/groups`
Returns groups the authenticated user is a member of, with member count.

### `POST /api/groups`
Creates a group and auto-adds the creator as a member (via `create_group` RPC).
- Body: `{ name: string }`
- Returns: 201 with created group

### `POST /api/groups/[id]/members`
Adds a member by email. If the user doesn't exist yet (hasn't signed up), this will fail — the target must have an account.
- Body: `{ email: string }`
- Returns: 201, or 409 if already a member, 404 if user not found

### `DELETE /api/groups/[id]/members`
Leaves the group (self-removal via `leave_group` RPC). Blocked if the caller's absolute balance exceeds $2.
- Returns: `{ data: { deletedGroup: boolean }, error: null }` — `deletedGroup` is true when the last member left

### `POST /api/groups/[id]/expenses`
Creates an expense with equal split among participants (via `create_expense` RPC).
- Body: `{ description: string, amountCents: number, date: "YYYY-MM-DD", paidById?: string, participantIds?: string[] }`
- Defaults: `paidById` = current user, `participantIds` = all group members
- Split logic: equal division, remainder cents distributed 1 at a time to first N participants

### `PUT /api/groups/[id]/expenses/[expenseId]`
Edits an expense and recalculates all splits atomically (via `update_expense` RPC). Change detection runs in TS, then passes `changes` JSONB to the RPC.
- Body: same shape as POST
- Only the expense creator can edit (NULL `createdById` = legacy, any member allowed)
- Returns 403 if the caller is not the creator

### `DELETE /api/groups/[id]/expenses/[expenseId]`
Deletes an expense (via `delete_expense` RPC). Cascade delete handles splits.
- Only the expense creator can delete (NULL `createdById` = legacy, any member allowed)
- Returns 403 if the caller is not the creator

### `POST /api/groups/[id]/payments`
Records a payment (money sent outside the app) as a special expense (via `create_payment` RPC).
- Body: `{ amountCents: number, date: "YYYY-MM-DD", paidById?: string, recipientId: string }`
- `paidById` defaults to current user (the sender); `recipientId` is who received the money
- The payment is stored as an Expense with `isPayment=true`; a single ExpenseSplit covers the recipient for the full amount — so it flows through `simplifyDebts` with zero changes

### `GET /api/groups/[id]/balances`
Computes simplified debts from all expenses and splits in the group. Uses the greedy algorithm in `lib/balances/simplify.ts`.
- Returns: `{ data: [{ fromId, fromName, toId, toName, amountCents }] }`

### `DELETE /api/account`
Permanently deletes the user's account. Calls `delete_account` RPC to leave all groups and delete the User row, then deletes the Supabase auth user via the admin client (service role key).
- Returns: `{ data: { deleted: true }, error: null }`

### `POST /api/invite/[token]/join`
Joins the group associated with the invite token. Uses the `join_group_by_token` RPC (idempotent — safe to call if already a member).
- Returns: `{ data: { groupId, alreadyMember }, error: null }`

## Data Flow

```
Browser → proxy.ts (auth check) → Page or Route Handler
                                        ↓
                                Supabase server client (get session from cookies)
                                        ↓
                                Supabase JS client queries (RLS-protected)
                                  or RPC calls (SECURITY DEFINER)
```

**Server-rendered pages** (dashboard, group detail): The server component fetches all needed data via Supabase in a single render pass, returns HTML. Interactive parts are wrapped in client components that receive server data as props.

**Mutations** (add/edit/delete expense, add member, create group): Client component → `fetch()` to API route → Zod validates input → Supabase RPC or query → JSON response. Client applies optimistic update before the fetch completes.

**Balances**: Computed on-demand from raw expense/split data. No stored balance table — always derived from source of truth.

## Auth System

### Flow
1. **Signup**: User submits email + password → Supabase sends confirmation email with `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback` → signup page shows "check your email" (no redirect)
2. **Email confirmation**: User clicks link → `auth/callback/route.ts` exchanges code for session, upserts User via Supabase (from auth metadata), redirects to `/dashboard`
3. **Login**: Email/password → Supabase creates session cookie → redirect to `/dashboard`
4. **Route protection**: `proxy.ts` intercepts all requests. Protected paths (`/dashboard`, `/groups/*`, `/settings`) redirect to `/login` without session. Auth paths (`/login`, `/signup`) redirect to `/dashboard` with session.
5. **User upsert**: `(app)/layout.tsx` upserts the User record on every authenticated page load, ensuring Supabase auth users always exist in the app database.

### Supabase configuration
- Site URL in Supabase dashboard: `https://aviary.gregbigelow.com`
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
page.tsx (server)                    ← Fetches all data via Supabase
  └─ GroupInteractive (client)       ← Manages expense, activity, and balance state
       ├─ Balances section           ← Client-rendered; recomputes on every expense change
       ├─ ExpensesList               ← Renders expenses with optimistic updates
       │    ├─ AddExpenseForm        ← Modal for new expenses
       │    └─ ExpenseActions (×N)   ← Edit/delete per expense
       └─ ActivityFeed               ← Renders activity log
  └─ AddMemberForm (client)          ← Separate: manages its own state
  └─ LeaveGroupButton (client)       ← Confirmation dialog, DELETE call, redirect
  └─ Members list (server HTML)      ← Static render of group members
```

### Client-Side fetch Pattern
**Never use `NEXT_PUBLIC_SITE_URL` in `fetch()` calls.** This hardcodes the domain and causes CORS failures. Use root-relative paths directly:

```ts
fetch(`/api/groups/...`, { method: "POST", ... });
```

## Expense Splitting

**Equal split** (currently the only mode):
- Total ÷ number of participants = base amount per person
- Remainder (amountCents % participantCount) is distributed 1 cent at a time to the first N participants
- Guarantees splits always sum to exactly the expense total

**Atomic creation**: Every expense mutation (create, edit, delete) runs inside a `SECURITY DEFINER` RPC function that handles the expense record, all split records, and the activity log entry in a single database transaction.

**Payer selection**: The expense creator can choose any group member as the payer (defaults to self). Participant filtering lets you exclude members from the split.

## Activity Log System

The activity log records every expense mutation (add, edit, delete) with enough data to render a human-readable description without additional DB queries.

### Files involved
| File | Role |
|---|---|
| `app/api/groups/[id]/expenses/route.ts` | Passes activity data to `create_expense` RPC |
| `app/api/groups/[id]/expenses/[expenseId]/route.ts` | Computes `changes` JSONB, passes to `update_expense`/`delete_expense` RPC |
| `app/(app)/groups/[id]/ActivityFeed.tsx` | Renders logs; contains `buildEditInfo()` for rich edit descriptions |
| `app/(app)/groups/[id]/useActivityLogs.ts` | Hook: manages optimistic log state and server reconciliation |
| `app/(app)/groups/[id]/ExpenseActions.tsx` | Computes and fires optimistic activity log entry on edit/delete |
| `app/(app)/groups/[id]/GroupInteractive.tsx` | Wires `useActivityLogs` to both `ExpensesList` and `ActivityFeed` |

### Payload shapes

**`expense_added`** and **`expense_deleted`**:
```json
{ "description": "Dinner", "amountCents": 3000, "paidByDisplayName": "Alice" }
```

**`payment_recorded`** and **`payment_deleted`**:
```json
{ "amountCents": 5000, "fromDisplayName": "Alice", "toDisplayName": "Bob" }
```
For `payment_deleted`, the from/to names are looked up inside the `delete_expense` RPC (not passed as params).

**`member_left`**:
```json
{ "displayName": "Alice" }
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
The PUT handler fetches the expense with paidBy user, splits (with user display names), and group members. After parsing the request body and resolving new values, it compares old vs new fields to build the `changes` object, then passes it to the `update_expense` RPC. Key detail: Supabase returns `expense.date` as an ISO string — extract `"YYYY-MM-DD"` with `expense.date.split("T")[0]` before comparing.

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

## Design Decisions

### Why Supabase JS client for both auth and data?
Single client, no connection management, no SSL cert bundling, no pg.Pool. RLS handles authorization at the DB layer. PostgREST (which powers the JS client) eliminates serverless connection pooling concerns entirely. Previously we used Prisma for data, but the pg.Pool + SSL cert + adapter bridge added unnecessary complexity.

### Why RPC functions for mutations?
Supabase JS doesn't support multi-table transactions natively. `SECURITY DEFINER` PL/pgSQL functions run as a single transaction and can write to multiple tables atomically. They bypass RLS (since they run as the function owner) and do their own auth checks via `auth.uid()`.

### Why `proxy.ts`?
Next.js 16 renamed middleware to `proxy.ts`. We confirmed `middleware.ts` doesn't work.

### Deployment
App lives on its own subdomain (`aviary.gregbigelow.com`) as a standalone Vercel project. No basePath — the app runs at the domain root. External services (email redirects, OAuth callbacks) use full URLs via `NEXT_PUBLIC_SITE_URL`.

### Why cents for money?
`0.1 + 0.2 !== 0.3`. Integers avoid floating point errors entirely.

### Why resource-oriented API routes?
Future mobile client should reuse the same API. `/api/groups/[id]/expenses` works for any client.

### Edit/delete permissions
Only the creator of an expense (the user who clicked "Add expense") can edit or delete it. Payments likewise enforce creator-only deletion. Expenses created before `createdById` was populated (NULL `createdById`) are treated as legacy and remain editable/deletable by any group member. Enforcement happens at three layers: UI hides buttons (`canEdit`/`canDelete` flags in `page.tsx`), API routes return 403, and RPC functions raise an exception.

### Settle up (not yet implemented)
Plan: Record settlements as special expenses (description = "Settlement", single split to creditor). Uses existing infrastructure, no schema migration needed.

### Group deletion (not yet implemented)
Plan: Hard delete. Cascade deletes handle all cleanup. No soft delete until audit trail is needed.

### Account deletion
Users can delete their account from the settings page. The `delete_account` RPC removes the user from all groups (skipping the $2 balance check that `leave_group` enforces), logs departures, auto-deletes empty groups, and deletes the User row. The API route then deletes the Supabase auth user via the admin client. Orphaned expenses and activity logs are intentional — they retain `paidById`/`actorId` references so other group members' financial history is preserved.

### Member self-removal (leave group)
Implemented via `leave_group` RPC. Members can leave if their absolute balance is ≤ $2 (200 cents). When the last member leaves, the group is cascade-deleted. Activity log records `member_left` with the leaver's display name.

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
- Things that are already covered by the framework (Next.js routing, Supabase query syntax)

### Smoke Tests (`tests/smoke.test.ts`)

Smoke tests are a **post-deploy health check**, not a pre-deploy safety net. Run them after pushing to verify production is working — not while developing. During development, use `SKIP_SMOKE_TESTS=1 npm test` to run only unit/integration tests (fast, no network).

**Prefer Cypress for new E2E coverage.** Smoke tests hit live production and are slow. For any user-facing flow or API behaviour that can be tested against a local dev server, write a Cypress spec instead. Add to smoke tests only for things that can only be verified post-deploy: production env var validation, etc.

**By default `npm test` hits live production** (`https://aviary.gregbigelow.com`). Override with:
```bash
SKIP_SMOKE_TESTS=1 npm test                                    # skip entirely
SMOKE_TEST_BASE_URL=http://localhost:3000 npm test tests/smoke.test.ts  # run against local dev
```

**What they cover:**
- Site reachability and auth redirects (unauthenticated → /login)
- All API endpoints return 401 for unauthenticated requests
- Full authenticated CRUD flow (requires `SMOKE_TEST_EMAIL` + `SMOKE_TEST_PASSWORD` in `.env.local`)

**Authenticated tests mutate prod data:** they create a group, add/edit/delete an expense, then clean up. The group is named `[smoke test — safe to delete]` and gets left behind if a test fails mid-run — safe to delete manually.

**When to run smoke tests:** after changes to `proxy.ts`, auth routes, API routes, or env vars.

### E2E Tests (Cypress)

**Stack:** Cypress 15 + TypeScript. Specs live in `cypress/e2e/`. Run against a local dev server.

**Setup:**
- `cypress.config.ts` — `baseUrl: http://localhost:3000`, video off, 10 s command timeout
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
| `cypress/e2e/dashboard.cy.ts` | Group list, create-group modal, link correctness |
| `cypress/e2e/group-detail.cy.ts` | Add/edit/delete expenses, activity feed, balances section |
| `cypress/e2e/navigation.cy.ts` | Nav bar, browser history back/forward |

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
