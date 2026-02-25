# Aviary — Architecture

Deep reference for how the app works. For workflow and commands, see CLAUDE.md.

## Core Concepts

Aviary is an expense-splitting app for groups of people. Three concepts drive the data model:

1. **Expenses**: One person pays an amount, and that amount is divided among 1 or more participants. The payer may or may not be a participant — e.g. Alice can pay for Bob and Carol's lunch without owing herself anything. Splits can be equal (automatic) or custom (per-person amounts that must sum to the total).

2. **Payments**: Records of money sent from one person to another outside the app (Venmo, cash, etc.). Stored as a special expense (`isPayment=true`) where `paidById` = sender and a single `ExpenseSplit` covers the recipient for the full amount. This means payments flow through the same balance computation pipeline as expenses with zero special-casing.

3. **Balances**: A simplified summary of who owes whom within a group, computed on-demand from all expenses and payments. The pipeline is: `buildRawDebts(expenses)` → `simplifyDebts(rawDebts)`. Convenience wrappers: `getUserDebtCents(expenses, userId)` returns how much a user owes (unsigned), `getUserBalanceCents(expenses, userId)` returns signed net balance (positive = owed money, negative = owes money). No balance data is stored — it's always derived from the source of truth (expense + split records). All balance functions live in `lib/balances/`.

Both expenses and payments can be edited and deleted, which immediately affects the computed balances.

## Project Structure

Monorepo with npm workspaces: root = Next.js web app, `packages/shared/` = shared business logic, `mobile/` = React Native (Expo) app.

```
packages/shared/                         # @aviary/shared — pure TS business logic (no React/DOM/Node deps)
  package.json                           # "main": "src/index.ts" — no build step, consumed as raw TS
  tsconfig.json                          # lib: ["esnext"] only (no dom) — enforces platform-agnostic code
  src/
    index.ts                             # Barrel re-export of everything below
    balances/                            # buildRawDebts, simplifyDebts, getUserDebt, splitAmount
    format.ts, formatDisplayName.ts      # Money + name formatting
    constants.ts                         # Character limits, emoji palette
    amount.ts                            # Amount input filtering, MAX_AMOUNT_CENTS
    percentageSplit.ts                   # Percentage ↔ cents conversion
    groupPattern.ts                      # Deterministic SVG pattern generation
    birdFacts.ts                         # Bird fact strings (shared between web + mobile dashboards)
    types.ts                             # Platform-agnostic types: ExpenseRow, ActivityLog, etc.
    validation.ts                        # Zod schemas extracted from API routes
    activityDiff.ts                      # computeExpenseChanges(), buildSplitSnapshot()
    rpcParams.ts                         # RPC parameter builders for Supabase .rpc() calls

mobile/                                  # React Native app (Expo SDK 52, Expo Router v4)
  package.json                           # Depends on @aviary/shared via workspace
  app/
    _layout.tsx                          # Root: fonts, providers (QueryClient, Auth, BottomSheet)
    (auth)/                              # Login + signup screens
      _layout.tsx                        # Redirects to (app) if already authenticated
      login.tsx, signup.tsx
    (app)/                               # Auth-protected screens
      _layout.tsx                        # Auth guard — redirects to (auth)/login if no session
      (dashboard)/
        _layout.tsx                      # Dashboard tab layout
        index.tsx                        # Group list with balances + bird fact
        create-group.tsx                 # Create group modal screen
      groups/[id]/
        index.tsx                        # Group detail: expenses, balances, members
        add-expense.tsx                  # Add expense form
        record-payment.tsx               # Record payment form
        add-member.tsx                   # Add member by email
        expense/[expenseId].tsx          # Expense detail/edit
        settings.tsx                     # Group settings (rename, banner)
      invite/[token].tsx                 # Join group via invite link
      settings/index.tsx                 # User settings (profile, logout, delete account)
  lib/
    supabase.ts                          # Supabase client with SecureStore for session persistence
    auth.tsx                             # AuthProvider context (session, user, loading, signOut)
    queryClient.ts                       # TanStack Query client instance
    types.ts                             # Re-exports shared types + platform-specific MemberColor, Member
    queries/                             # TanStack Query hooks (direct-to-Supabase, no API intermediary)
      keys.ts                            # Query key factory (groupKeys, userKeys, inviteKeys)
      shared.ts                          # Re-exports from @aviary/shared for mobile consumption
      groups.ts, expenses.ts, payments.ts, members.ts, activity.ts, user.ts, invite.ts
  components/
    ErrorBoundary.tsx                    # App-level error boundary
    ui/                                  # Mobile UI primitives (NativeWind-styled)
      Avatar.tsx, Button.tsx, Card.tsx, Input.tsx, LoadingSpinner.tsx,
      MemberPill.tsx, BottomSheet.tsx

app/                                     # Next.js web app (below)
  layout.tsx                             # Root layout: Geist fonts, metadata, dark mode class
  page.tsx                               # Root redirect: authed → /dashboard, else → /login
  globals.css                            # Tailwind base + custom animations (fade-in, slide-up, etc.)

  (auth)/                                # Route group: public auth pages
    login/page.tsx                       # Email/password + Google sign-in form (client component)
    signup/page.tsx                      # Signup form with "check your email" confirmation state (client)
  auth/callback/route.ts                 # GET handler: exchanges email confirmation code for session,
                                         #   upserts User via Supabase, redirects to /dashboard

  (app)/                                 # Route group: auth-protected pages
    layout.tsx                           # Auth guard (redirects to /login if no session), renders Nav,
                                         #   upserts User record from Supabase metadata on every request
    dashboard/
      page.tsx                           # Lists user's groups with balance summaries + bird facts (server)
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
                                         #   participant checkboxes, split mode (equal/custom/percentage);
                                         #   POSTs to expenses API
      ExpenseDetailModal.tsx             # Modal: view/edit/delete expense details; split breakdown
      ExpenseActions.tsx                 # Edit/delete buttons + optimistic activity log computation
      RecordPaymentForm.tsx              # Modal: record payment between two members
      MemberPill.tsx                     # Colored member chip with avatar/emoji + name
      CopyInviteLinkButton.tsx           # Copy invite link to clipboard / native share
      useInviteShare.ts                  # Hook: invite link generation + Web Share API
      LeaveGroupButton.tsx               # Leave group: confirmation dialog, DELETE call, redirect
      GroupSettingsButton.tsx             # Gear button → opens GroupSettingsModal
      GroupSettingsModal.tsx              # Modal: rename group, upload/change banner image
      ExportButton.tsx                   # Download group expenses as Excel spreadsheet
      ActivityFeed.tsx                   # Renders activity log entries with relative timestamps
      useActivityLogs.ts                 # Hook: manages activity log state with optimistic additions
                                         #   and server reconciliation
      loading.tsx                        # Suspense fallback for group page
    settings/
      page.tsx                           # Settings page: fetches user info + group balances (server)
      SettingsClient.tsx                 # Profile picture, emoji, account deletion (client)
    invite/[token]/
      page.tsx                           # Invite preview: shows group name + member count (server)
      InviteJoinForm.tsx                 # Join button for non-members (client)

  (legal)/
    privacy/page.tsx                     # Privacy Policy
    terms/page.tsx                       # Terms of Service

  api/account/
    route.ts                             # DELETE: delete account (RPC + admin auth user deletion)
    profile-picture/route.ts             # POST: upload compressed profile picture to Supabase storage
  api/groups/
    route.ts                             # GET: list user's groups; POST: create group (via RPC)
    [id]/
      members/route.ts                   # POST: add member; DELETE: leave group (via leave_group RPC)
      expenses/route.ts                  # POST: create expense + equal splits + activity log (via RPC)
      expenses/[expenseId]/route.ts      # PUT: edit expense + recalculate splits (via RPC)
                                         # DELETE: delete expense + log (via RPC)
      balances/route.ts                  # GET: compute simplified debts from expenses/splits
      payments/route.ts                  # POST: record payment (via create_payment RPC)
      activity/route.ts                  # GET: paginated activity logs for group
      export/route.ts                    # GET: download group expenses as .xlsx spreadsheet
      settings/route.ts                  # GET: group settings; PUT: rename group, update banner
      recurring/[recurringId]/route.ts   # PUT: update recurring expense; DELETE: cancel recurring
  api/invite/[token]/
    join/route.ts                        # POST: join group via invite token (via join_group_by_token RPC)
  api/feedback/
    route.ts                             # POST: submit user feedback
  api/cron/
    process-recurring/route.ts           # POST: auto-create expenses from recurring templates (cron)

components/
  Nav.tsx                                # Top nav: Aviary logo, user email, settings link, feedback, logout
  FeedbackModal.tsx                      # User feedback form modal
  GroupThumbnail.tsx                     # Group card thumbnail (pattern or banner image)
  InstallPrompt.tsx                      # PWA install prompt (mobile browsers only)
  ServiceWorkerRegistration.tsx          # Service worker for PWA offline support
  ui/Button.tsx                          # Button with variants (primary, secondary, ghost, danger)
  ui/Card.tsx                            # Card container with consistent padding/border
  ui/Input.tsx                           # Input with label, error message, full-width styling
  ui/GoogleSignInButton.tsx              # Google OAuth login button
  ui/DelayedFallback.tsx                 # Suspense fallback that delays visibility to avoid flicker

lib/
  supabase/client.ts                     # Browser Supabase client (createBrowserClient<Database>)
  supabase/server.ts                     # Server Supabase client (cookie-aware, for RSC + route handlers)
  supabase/admin.ts                      # Server-only admin client (service role key, bypasses RLS)
  supabase/database.types.ts             # Auto-generated types from Supabase schema (run npm run db:types)
  balances/*.ts                          # Re-export barrels → @aviary/shared (source lives in packages/shared/)
  format.ts                              # Re-export barrel → @aviary/shared
  formatDisplayName.ts                   # Re-export barrel → @aviary/shared
  constants.ts                           # Re-export barrel → @aviary/shared
  amount.ts                              # Re-export barrel → @aviary/shared
  percentageSplit.ts                     # Re-export barrel → @aviary/shared
  groupPattern.ts                        # Re-export barrel → @aviary/shared
  compressImage.ts                       # Client-side image compression (Canvas API, web-only)
  export/buildExportData.ts              # Transform expense data for spreadsheet export
  export/generateSpreadsheet.ts          # Generate .xlsx file using exceljs

supabase/
  migrations/                            # SQL migrations applied via `npx supabase db push`
  config.toml                            # Supabase CLI config (auto-generated by supabase init)

proxy.ts                                 # Auth middleware (Next.js 16 uses proxy.ts, NOT middleware.ts)
next.config.ts                           # turbopack config
```

## Data Models

All monetary values are **integers (cents)**. Never floats. All `id` columns are `text` with `gen_random_uuid()::text` defaults.

```
User
  id                  String    @id @default(uuid)
  email               String    @unique
  displayName         String
  avatarUrl           String?              // from OAuth provider (Google profile picture)
  profilePictureUrl   String?              // user-uploaded profile picture (Supabase storage)
  defaultEmoji        String    @default   // random emoji from MEMBER_EMOJIS, fallback avatar
  createdAt           DateTime  @default(now())

Group
  id            String    @id @default(uuid)
  name          String
  createdAt     DateTime  @default(now())
  createdById   String    → User
  inviteToken   String    @default(uuid)   // shareable invite link token
  patternSeed   Int       @default(random) // seed for deterministic SVG pattern generation
  bannerUrl     String?                    // user-uploaded group banner image

GroupMember
  id            String    @id @default(uuid)
  groupId       String    → Group (cascade delete)
  userId        String    → User (cascade delete)
  joinedAt      DateTime  @default(now())
  @@unique([groupId, userId])

Expense
  id                  String    @id @default(uuid)
  groupId             String    → Group (cascade delete)
  paidById            String    → User
  description         String
  amountCents         Int       CHECK > 0
  date                DateTime
  createdAt           DateTime  @default(now())
  updatedAt           DateTime? // auto-set by trigger on UPDATE; NULL = never edited
  isPayment           Boolean   @default(false)   // true for payments recorded via Record Payment
  createdById         String?   → User            // set on creation; creator-only edit/delete enforced in RPC
  splitType           String    @default('equal') CHECK IN ('equal', 'custom')
  settledUp           Boolean   @default(false)   // marks a payment as settled
  recurringExpenseId  String?   → RecurringExpense // links to recurring template if auto-generated

ExpenseSplit
  id            String    @id @default(uuid)
  expenseId     String    → Expense (cascade delete)
  userId        String    → User
  amountCents   Int       CHECK >= 0
  @@unique([expenseId, userId])

RecurringExpense
  id              String    @id @default(uuid)
  groupId         String    → Group (cascade delete)
  createdById     String    → User
  description     String
  amountCents     Int       CHECK > 0
  paidById        String    → User
  participantIds  String[]            // array of user IDs
  splitType       String    @default('equal')
  frequency       String    CHECK IN ('weekly', 'monthly', 'yearly')
  nextOccurrence  Date                // next date to auto-create
  lastProcessed   DateTime?           // when cron last created an expense from this
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())

ActivityLog
  id            String    @id @default(uuid)
  groupId       String    → Group (cascade delete)
  actorId       String    → User
  action        String    CHECK IN ('expense_added', 'expense_edited', 'expense_deleted',
                                    'payment_recorded', 'payment_deleted', 'member_left')
  payload       Json      // See "Activity Log System" section below for full payload shape
  createdAt     DateTime  @default(now())

Feedback
  id            String    @id @default(uuid)
  userId        String    → User
  message       String
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

`SECURITY DEFINER` PL/pgSQL functions handle atomic multi-table operations. They bypass RLS and do their own auth checks internally. Each function has exactly one overload (stale overloads from earlier migrations were cleaned up).

| Function | Purpose | Called from |
|----------|---------|------------|
| `create_group(_name)` | Creates group + adds creator as member + generates invite token + pattern seed | `POST /api/groups` |
| `create_expense(...)` | Creates expense + splits + activity log | `POST /api/groups/[id]/expenses` |
| `update_expense(...)` | Updates expense + replaces splits + activity log | `PUT /api/groups/[id]/expenses/[expenseId]` |
| `delete_expense(...)` | Activity log + deletes expense (cascade handles splits) | `DELETE /api/groups/[id]/expenses/[expenseId]` |
| `leave_group(_group_id)` | Verifies membership, blocks if user has any outstanding debt, deletes member row, logs `member_left`, deletes group if last member | `DELETE /api/groups/[id]/members` |
| `delete_account()` | Removes user from all groups (no balance check), logs departures, auto-deletes empty groups, deletes User row. Auth user deletion handled by API route via admin client. Orphaned expenses/activity logs retain their `paidById`/`actorId` references. | `DELETE /api/account` |
| `get_group_by_invite_token(_token)` | Returns `{ id, name, memberCount, isMember }` for invite preview; SECURITY DEFINER so non-members can read group name | `app/(app)/invite/[token]/page.tsx` (server component) |
| `join_group_by_token(_token)` | Adds caller as group member; idempotent; returns `{ groupId, alreadyMember }` | `POST /api/invite/[token]/join` |
| `create_payment(...)` | Creates payment expense + single split for recipient + activity log | `POST /api/groups/[id]/payments` |
| `add_member_by_email(_group_id, _email)` | Looks up user by email, adds as group member. Atomic: auth check → user lookup → duplicate check → insert. Returns `{ userId, displayName, groupId, joinedAt }` | Mobile `add-member.tsx` (direct RPC) |

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
Leaves the group (self-removal via `leave_group` RPC). Blocked if the caller has any outstanding debt (owes money).
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

### `GET /api/groups/[id]/export`
Downloads group expenses as an Excel spreadsheet (.xlsx). Uses `exceljs` to generate the file.
- Returns: Excel file as binary download

### `GET /api/groups/[id]/settings`
Returns group settings (name, banner URL).

### `PUT /api/groups/[id]/settings`
Updates group settings (rename, banner image).
- Body: `{ name?: string, bannerUrl?: string }`

### `PUT /api/groups/[id]/recurring/[recurringId]`
Updates a recurring expense template (description, amount, frequency, participants, etc.).

### `DELETE /api/groups/[id]/recurring/[recurringId]`
Deactivates a recurring expense template.

### `POST /api/account/profile-picture`
Uploads a compressed profile picture to Supabase storage. Client compresses the image before uploading.

### `POST /api/feedback`
Submits user feedback.
- Body: `{ message: string }`

### `POST /api/cron/process-recurring`
Cron endpoint that auto-creates expenses from active recurring templates whose `nextOccurrence` has passed. Advances `nextOccurrence` after processing.

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
page.tsx (server)                         ← Fetches all data via Supabase
  ├─ Banner hero                          ← Uploaded image or generated SVG pattern
  ├─ MemberPill (×N)                      ← Colored chips with avatar/emoji + name
  ├─ CopyInviteLinkButton                 ← Copy/share invite link
  ├─ GroupInteractive (client)            ← Manages expense, activity, and balance state
  │    ├─ Balances section                ← Client-rendered; recomputes on every expense change
  │    ├─ ExpensesList                    ← Renders expenses with optimistic updates
  │    │    ├─ AddExpenseForm             ← Modal: new expense (equal/custom/percentage splits)
  │    │    ├─ RecordPaymentForm          ← Modal: record payment between members
  │    │    ├─ ExpenseDetailModal (×N)    ← View/edit expense details + split breakdown
  │    │    └─ ExpenseActions (×N)        ← Edit/delete + optimistic activity log
  │    ├─ ActivityFeed                    ← Renders activity log (paginated)
  │    └─ ExportButton                   ← Download group as Excel
  ├─ GroupSettingsButton → GroupSettingsModal  ← Rename group, change banner
  └─ LeaveGroupButton (client)            ← Confirmation dialog, DELETE call, redirect
```

### Client-Side fetch Pattern
All client-side `fetch()` calls use root-relative paths:

```ts
fetch(`/api/groups/...`, { method: "POST", ... });
```

## Expense Splitting

Three split modes are supported in the UI (stored as two `splitType` values in the DB):

**Equal split** (`splitType = 'equal'`, default):
- Total ÷ number of participants = base amount per person
- Remainder (amountCents % participantCount) is distributed 1 cent at a time to the first N participants
- Guarantees splits always sum to exactly the expense total

**Custom split** (`splitType = 'custom'`):
- Per-person amounts provided by the user
- API validates that custom split amounts sum to exactly the expense total
- Zero-amount splits are valid (participant opted out but still in the group)

**Percentage split** (UI-only mode, stored as `splitType = 'custom'`):
- Per-person percentages that must sum to 100%
- Converted to cent amounts via `percentagesToCents()` in `lib/percentageSplit.ts`
- Remainder from rounding distributed to first N participants (same as equal split)

**Payer exclusion**: The payer is not required to be a participant. For example, Alice can pay $60 for Bob and Carol's lunch — Alice has no split record, and both Bob and Carol owe Alice $30. This is important for the balance computation: `buildRawDebts` skips splits where `userId === paidById`, so payer-excluded expenses naturally produce debts from all participants to the payer.

**Atomic creation**: Every expense mutation (create, edit, delete) runs inside a `SECURITY DEFINER` RPC function that handles the expense record, all split records, and the activity log entry in a single database transaction.

**Payer selection**: The expense creator can choose any group member as the payer (defaults to self). Participant filtering lets you include or exclude any group members from the split.

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
Single client, no connection management, no SSL cert bundling, no pg.Pool. RLS handles authorization at the DB layer. PostgREST (which powers the JS client) eliminates serverless connection pooling concerns entirely.

### Why RPC functions for mutations?
Supabase JS doesn't support multi-table transactions natively. `SECURITY DEFINER` PL/pgSQL functions run as a single transaction and can write to multiple tables atomically. They bypass RLS (since they run as the function owner) and do their own auth checks via `auth.uid()`.

### Why `proxy.ts`?
Next.js 16 renamed middleware to `proxy.ts`. We confirmed `middleware.ts` doesn't work.

### Deployment
App lives on its own subdomain (`aviary.gregbigelow.com`) as a standalone Vercel project. No basePath — the app runs at the domain root. External services (email redirects, OAuth callbacks) use full URLs via `NEXT_PUBLIC_SITE_URL`.

### Why cents for money?
`0.1 + 0.2 !== 0.3`. Integers avoid floating point errors entirely.

### Why DROP + CREATE for RPC function migrations?
PostgreSQL's `CREATE OR REPLACE FUNCTION` only replaces a function with the **exact same parameter signature**. If you add or remove parameters, it creates a new overload instead. This caused a bug where stale overloads with missing auth checks coexisted with the intended version. Always use `DROP FUNCTION IF EXISTS fn_name(param_types)` followed by `CREATE FUNCTION` when changing a function's signature.

### Why resource-oriented API routes?
Future mobile client should reuse the same API. `/api/groups/[id]/expenses` works for any client.

### Edit/delete permissions
Only the creator of an expense (the user who clicked "Add expense") can edit or delete it. Payments likewise enforce creator-only deletion. Expenses created before `createdById` was populated (NULL `createdById`) are treated as legacy and remain editable/deletable by any group member. Enforcement happens at three layers: UI hides buttons (`canEdit`/`canDelete` flags in `page.tsx`), API routes return 403, and RPC functions raise an exception.

### Payments (settle up)
Implemented via `create_payment` RPC. Payments record money sent outside the app (Venmo, cash, etc.) as a special expense with `isPayment=true`. See "Core Concepts" above for how this flows through the balance pipeline.

### Group deletion (not yet implemented)
Plan: Hard delete. Cascade deletes handle all cleanup. No soft delete until audit trail is needed.

### Account deletion
Users can delete their account from the settings page. The `delete_account` RPC removes the user from all groups (skipping the $2 balance check that `leave_group` enforces), logs departures, auto-deletes empty groups, and deletes the User row. The API route then deletes the Supabase auth user via the admin client. Orphaned expenses and activity logs are intentional — they retain `paidById`/`actorId` references so other group members' financial history is preserved.

### Member self-removal (leave group)
Implemented via `leave_group` RPC. Members can leave if they have no outstanding debt (net balance ≥ 0). When the last member leaves, the group is cascade-deleted. Activity log records `member_left` with the leaver's display name.

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
| `cypress/e2e/invite.cy.ts` | Invite link flow, join group via token |
| `cypress/e2e/settings.cy.ts` | Profile settings, account deletion |
| `cypress/e2e/recurring-expenses.cy.ts` | Recurring expense setup and processing |

**Selectors:** Prefer existing `id` attributes (`#email`, `#expenseDescription`) and `aria-label` attributes (`[aria-label="Edit expense"]`) over brittle class selectors. All modals have `.modal-content` for scoping assertions.

**Running E2E tests:**
```bash
npm run dev                   # Start dev server first
npm run cy:open               # Interactive GUI
npm run cy:run                # Headless CI mode
```

## Additional Features (beyond core CRUD)

These features extend the core expense-splitting functionality:

| Feature | Key files | Notes |
|---------|-----------|-------|
| **Recurring expenses** | `RecurringExpense` table, `api/cron/process-recurring/`, `api/groups/[id]/recurring/` | Weekly/monthly/yearly auto-creation via cron |
| **Group settings** | `GroupSettingsButton.tsx`, `GroupSettingsModal.tsx`, `api/groups/[id]/settings/` | Rename group, upload custom banner image |
| **Profile pictures** | `SettingsClient.tsx`, `api/account/profile-picture/`, `lib/compressImage.ts` | Client-side compression → Supabase storage |
| **Group patterns** | `lib/groupPattern.ts`, `GroupThumbnail.tsx` | Deterministic SVG thumbnails + banners from `patternSeed` |
| **Invite system** | `CopyInviteLinkButton.tsx`, `useInviteShare.ts`, `invite/[token]/` | Shareable token-based invite links |
| **Export** | `ExportButton.tsx`, `lib/export/`, `api/groups/[id]/export/` | Download group expenses as .xlsx |
| **Feedback** | `FeedbackModal.tsx`, `api/feedback/` | In-app feedback form |
| **PWA** | `InstallPrompt.tsx`, `ServiceWorkerRegistration.tsx` | Install prompt + offline support |
| **Google Sign-In** | `GoogleSignInButton.tsx`, login/signup pages | OAuth via Supabase |
| **Split modes** | `AddExpenseForm.tsx`, `lib/percentageSplit.ts` | Equal, custom dollar amounts, or percentage |

## Shared Pure Logic (`@aviary/shared`)

All pure business logic lives in `packages/shared/src/` and is published as the `@aviary/shared` workspace package. **Zero framework dependencies** — no React, no DOM, no Node.js APIs. Both the web app and mobile app consume this package.

**Web app access:** Existing `lib/` files are re-export barrels that forward to `@aviary/shared`. This means `import { formatCents } from "@/lib/format"` still works — but the source of truth is in `packages/shared/`.

**Mobile app access:** Imports via `@aviary/shared` (through `mobile/lib/queries/shared.ts` re-export layer).

**Adding to the shared package:** Add your file to `packages/shared/src/`, export from `packages/shared/src/index.ts`, and create a re-export barrel in `lib/` if web code needs the old import path.

| File (in `packages/shared/src/`) | Exports | Test coverage |
|------|---------|---------------|
| `balances/simplify.ts` | `simplifyDebts(debts)` — greedy debt simplification | 150+ tests |
| `balances/buildRawDebts.ts` | `buildRawDebts(expenses)` — expenses→debt pairs | Thorough |
| `balances/getUserDebt.ts` | `getUserDebtCents()`, `getUserBalanceCents()` | Thorough |
| `balances/splitAmount.ts` | `splitAmount(cents, n)` — equal split with remainder | Thorough |
| `format.ts` | `formatCents(cents)` → `"$X.XX"`, `UNKNOWN_USER` | Simple |
| `formatDisplayName.ts` | `formatDisplayName(name)` → abbreviated | Thorough |
| `constants.ts` | `MAX_GROUP_NAME`, `MAX_EXPENSE_DESCRIPTION`, `MEMBER_EMOJIS`, etc. | Thorough |
| `amount.ts` | `filterAmountInput()`, `formatAmountDisplay()`, `MAX_AMOUNT_CENTS` | Thorough |
| `percentageSplit.ts` | `percentagesToCents()`, `centsToPercentages()` | Thorough |
| `groupPattern.ts` | `generateGroupPattern()`, `generateGroupBanner()` | Thorough |
| `birdFacts.ts` | `BIRD_FACTS` — array of bird fact strings | — |
| `types.ts` | `ExpenseRow`, `ActivityLog`, `UserOwesDebt`, `SplitEntry`, `ResolvedDebt`, `GroupSummary` | — |
| `validation.ts` | Zod schemas: `createExpenseSchema`, `updateExpenseSchema`, `createPaymentSchema`, `createGroupSchema`, `updateSettingsSchema`, `addMemberSchema`, `feedbackSchema` | — |
| `activityDiff.ts` | `computeExpenseChanges()`, `buildSplitSnapshot()` — activity log change detection | — |
| `rpcParams.ts` | `buildCreateExpenseParams()`, `buildUpdateExpenseParams()`, `buildCreatePaymentParams()`, `buildDeleteExpenseParams()`, `buildCreateRecurringExpenseParams()` | — |

## Mobile App Architecture

The mobile app is a React Native app built with Expo SDK 52, Expo Router v4, NativeWind v4 (Tailwind for RN), and TanStack Query v5.

### Key difference from web: Direct-to-Supabase

The web app routes mutations through Next.js API routes (`fetch('/api/groups/...')`). The mobile app calls Supabase **directly** — queries via the JS client and mutations via `supabase.rpc()`. There is no API intermediary. This works because:
- RLS policies enforce authorization at the database layer
- RPC functions (`SECURITY DEFINER`) handle atomic multi-table operations
- Zod validation schemas from `@aviary/shared` validate input before RPC calls

### Mobile auth flow

1. Supabase client configured with `expo-secure-store` for session persistence (encrypted on-device storage)
2. `AuthProvider` (`mobile/lib/auth.tsx`) restores session on mount via `getSession()`, then listens for changes via `onAuthStateChange`
3. `(app)/_layout.tsx` checks `session` — redirects to `(auth)/login` if null
4. `(auth)/_layout.tsx` checks `session` — redirects to `(app)` if authenticated
5. `detectSessionInUrl: false` — mobile doesn't handle URL-based auth callbacks

### Mobile data layer

All data fetching uses TanStack Query hooks in `mobile/lib/queries/`:
- **Query key factory** (`keys.ts`): Centralized keys like `groupKeys.all`, `groupKeys.expenses(id)` for consistent cache invalidation
- **Hooks**: `useGroups()`, `useGroupDetail(id)`, `useGroupExpenses(id)`, `useCreateExpense()`, `useCreatePayment()`, etc.
- **Mutations** invalidate relevant query keys on success (e.g., creating an expense invalidates `groupKeys.expenses(id)` and `groupKeys.all`)
- **Shared imports**: `mobile/lib/queries/shared.ts` re-exports from `@aviary/shared` — single seam for all shared logic imports

### Platform-specific types

`MemberColor` is platform-specific: web uses `{ bg: string; text: string }` (Tailwind class objects), mobile uses a string union (`"rose" | "sky" | ...`). The `Member` type includes `MemberColor`, so it's also kept per-platform. All other types (`ExpenseRow`, `ActivityLog`, etc.) are shared via `@aviary/shared`.

### Mobile testing

See `mobile/TESTING.md` for the full testing guide. Key points:
- Same stack as web: Vitest 4 + `@testing-library/react` + happy-dom
- React Native components mocked to HTML elements (`View` → `<div>`, `Text` → `<span>`, `Pressable` → `<button>`)
- Expo modules mocked globally in `vitest.setup.ts`
- Mobile tests run separately: `cd mobile && npm test`
- Root vitest config excludes `mobile/**` to prevent cross-contamination

## Open Questions

- **Dashboard balance cost**: Per-group net balance requires joining expenses+splits for each group. Fine for <50 groups/user, may need materialized balances later.
- **Expense categories**: Small predefined enum with "Other"? Or free-text tags?
- **Notifications**: Start with in-app toasts. Email notifications are a separate effort.
