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
      GroupInteractive.tsx               # Client wrapper: combines ExpensesList + ActivityFeed,
                                         #   passes server-fetched data as initial props
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
  payload       Json      // { description, amountCents, paidByDisplayName }
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
The expense list and activity feed both use optimistic updates:

1. User triggers action (add/edit/delete expense)
2. Client immediately updates local state with `isPending: true` flag
3. API request fires in background
4. **Success**: `router.refresh()` triggers server re-render, replacing optimistic state with real data
5. **Failure**: `router.refresh()` reverts to server state

Pending items render with fade animations. The `isPending` flag prevents user interaction with in-flight items.

**Key files**: `ExpensesList.tsx` manages expense optimistic state. `useActivityLogs.ts` manages activity log optimistic state. `GroupInteractive.tsx` coordinates both.

### Component Hierarchy (Group Detail Page)
```
page.tsx (server)                    ← Fetches all data via Prisma
  └─ GroupInteractive (client)       ← Manages expense + activity state
       ├─ AddExpenseForm             ← Modal for new expenses
       ├─ ExpensesList               ← Renders expenses with optimistic updates
       │    └─ ExpenseActions (×N)   ← Edit/delete per expense
       └─ ActivityFeed               ← Renders activity log
  └─ AddMemberForm (client)          ← Separate: manages its own state
  └─ Balances section (server HTML)  ← Static render of simplified debts
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

## Open Questions

- **Dashboard balance cost**: Per-group net balance requires joining expenses+splits for each group. Fine for <50 groups/user, may need materialized balances later.
- **Expense categories**: Small predefined enum with "Other"? Or free-text tags?
- **Notifications**: Start with in-app toasts. Email notifications are a separate effort.
- **Mobile client**: Same API routes + CORS headers for cross-origin native apps.
- **Non-equal splits UI**: Per-person amount entry (not percentages). "Equal" default, "Custom" toggle.
