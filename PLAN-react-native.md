# React Native Monorepo Plan

## Overview

Add a React Native (Expo) mobile app to the existing Aviary repo as a monorepo, sharing TypeScript business logic between the Next.js web app and the new mobile app. The mobile app will have full feature parity with the web app, designed to feel truly native on iOS and Android.

**Data architecture: both clients talk directly to Supabase.** The Supabase JS client + RLS + RPC functions _are_ the API. No Next.js API intermediary for the mobile app. The RPCs handle atomicity, auth checks, and multi-table writes. RLS handles read authorization. Both web and mobile call the same RPCs and query the same tables — the shared package ensures identical business logic on both platforms.

---

## 1. Monorepo Structure

**Approach:** npm workspaces. The Next.js app stays at the repo root (zero disruption to Vercel deployment). Shared code moves into `packages/shared/`. The Expo app lives in `mobile/`.

```
aviary/                          # Root workspace (Next.js web app)
  package.json                   # workspaces: ["packages/*", "mobile"]
  app/                           # Next.js App Router (unchanged)
  components/                    # Web-only React components
  lib/                           # Web imports from @aviary/shared + web-specific code
  mobile/                        # NEW: Expo React Native app
    package.json                 # name: "mobile", depends on @aviary/shared
    app/                         # Expo Router screens (file-based routing)
    components/                  # Mobile-specific RN components
    lib/                         # Mobile-specific code (supabase client, etc.)
    assets/                      # App icons, splash screens
    app.json                     # Expo config
    metro.config.js              # Metro bundler config (monorepo-aware)
    tsconfig.json                # Extends root, adds RN types
    babel.config.js              # For NativeWind + Expo
  packages/
    shared/                      # NEW: Pure TypeScript package
      package.json               # name: "@aviary/shared"
      src/
        balances/                # buildRawDebts, simplify, getUserDebt, splitAmount
        format.ts                # formatCents, UNKNOWN_USER
        formatDisplayName.ts     # "First L." abbreviation
        constants.ts             # MAX_GROUP_NAME, MEMBER_EMOJIS, etc.
        amount.ts                # Amount filtering/formatting
        percentageSplit.ts       # Percentage ↔ cents conversion
        groupPattern.ts          # Deterministic SVG pattern generation
        types.ts                 # Shared TypeScript types (Debt, ExpenseForDebt, etc.)
        validation.ts            # Zod schemas extracted from API routes
        activityDiff.ts          # NEW: Change diff computation for expense edits
        rpcParams.ts             # NEW: Builders for RPC call parameters
      tsconfig.json
      package.json
```

**Why keep Next.js at root?**
- Zero changes to Vercel deployment (it auto-detects root Next.js)
- No need to update CI, environment variables, or import paths in the existing 30+ files
- The web app is the stable revenue-generating product — minimizing risk to it is worth the slightly unconventional root placement

**Workspace config (root package.json):**
```json
{
  "workspaces": ["packages/*", "mobile"]
}
```

---

## 2. Shared Package (`@aviary/shared`)

### What moves into the shared package

These are all **pure TypeScript functions** with zero React/Next.js/DOM dependencies:

| File | Current location | Exports |
|------|-----------------|---------|
| Balance pipeline | `lib/balances/*.ts` | `buildRawDebts`, `simplifyDebts`, `getUserDebtCents`, `getUserBalanceCents`, `splitAmount`, `Debt`, `ExpenseForDebt` |
| Money formatting | `lib/format.ts` | `formatCents`, `UNKNOWN_USER` |
| Display names | `lib/formatDisplayName.ts` | `formatDisplayName` |
| Constants | `lib/constants.ts` | `MAX_GROUP_NAME`, `MAX_EXPENSE_DESCRIPTION`, `MEMBER_EMOJIS`, etc. |
| Amount utilities | `lib/amount.ts` | `filterAmountInput`, `formatAmountDisplay`, `stripAmountFormatting`, `MAX_AMOUNT_CENTS` |
| Percentage splits | `lib/percentageSplit.ts` | `percentagesToCents`, `centsToPercentages` |
| Group patterns | `lib/groupPattern.ts` | `generateGroupPattern`, `generateGroupBanner`, `seedToBytes`, `resolvePatternDNA` |
| **NEW: Validation schemas** | extracted from API routes | Zod schemas for expense, group, payment input |
| **NEW: Shared types** | extracted from components | `ExpenseRow`, `Member`, `ActivityLog` types |
| **NEW: Activity diff** | extracted from API route + client components | `computeExpenseChanges()`, `buildSplitSnapshots()` |
| **NEW: RPC param builders** | extracted from API routes | `buildCreateExpenseParams()`, `buildUpdateExpenseParams()`, `buildDeleteExpenseParams()`, `buildCreatePaymentParams()` |

### NEW: Activity Diff & RPC Parameter Builders

Currently, the expense change-diff computation (for activity logs) is duplicated in **three places**: the API route, `ExpenseActions.tsx`, and `ExpenseDetailModal.tsx`. Moving to direct Supabase access forces us to consolidate this into one shared implementation — which is a strict improvement.

```ts
// @aviary/shared/src/activityDiff.ts
export interface ExpenseChanges {
  amount?: { from: number; to: number };
  description?: { from: string; to: string };
  date?: { from: string; to: string };
  paidBy?: { from: string; to: string };
  participants?: { added: string[]; removed: string[] };
  splitType?: { from: string; to: string };
}

export function computeExpenseChanges(
  old: { amountCents: number; description: string; date: string; paidById: string; splits: Array<{ userId: string; amountCents: number }> },
  new_: { amountCents: number; description: string; date: string; paidById: string; participantIds: string[]; splitType: string },
  members: Array<{ userId: string; displayName: string }>
): ExpenseChanges { /* ... */ }

export function buildSplitSnapshots(
  splits: Array<{ userId: string; amountCents: number }>,
  members: Array<{ userId: string; displayName: string }>
): Array<{ displayName: string; amountCents: number }> { /* ... */ }
```

```ts
// @aviary/shared/src/rpcParams.ts — ensures both web and mobile build identical RPC payloads
export function buildCreateExpenseParams(input: {
  groupId: string; description: string; amountCents: number; date: string;
  paidById: string; participantIds: string[];
  members: Array<{ userId: string; displayName: string }>;
  splitType: "equal" | "custom" | "percentage"; splitAmounts?: number[];
}) {
  const paidByName = input.members.find(m => m.userId === input.paidById)?.displayName ?? "Unknown";
  const participantNames = input.participantIds.map(id =>
    input.members.find(m => m.userId === id)?.displayName ?? "Unknown"
  );
  return {
    _group_id: input.groupId,
    _description: input.description,
    _amount_cents: input.amountCents,
    _date: input.date,
    _paid_by_id: input.paidById,
    _participant_ids: input.participantIds,
    _paid_by_display_name: paidByName,
    _split_type: input.splitType,
    _split_amounts: input.splitAmounts ?? null,
    _participant_display_names: participantNames,
  };
}
// Similar builders for update_expense, delete_expense, create_payment
```

### What stays web-only

- `lib/supabase/server.ts` — uses `next/headers` (cookies)
- `lib/supabase/client.ts` — uses `@supabase/ssr` browser client
- `lib/supabase/admin.ts` — server-only admin client
- `lib/supabase/database.types.ts` — stays at root, both web and mobile reference it (or we move it to shared)
- `lib/export/` — spreadsheet generation uses `exceljs` (web-only for now)
- `lib/compressImage.ts` — uses browser Canvas API

### Migration strategy

1. Create `packages/shared/` with its own `package.json` and `tsconfig.json`
2. Move files, updating imports
3. In the web app, update all `@/lib/balances/...` → `@aviary/shared/balances/...` (or re-export from `lib/` for minimal churn)
4. Run existing tests to confirm nothing broke
5. Move tests alongside the shared code

**Re-export approach (minimize web churn):** Keep `lib/balances/index.ts` etc. as re-export barrels:
```ts
// lib/balances/index.ts
export { buildRawDebts, type ExpenseForDebt } from "@aviary/shared/balances/buildRawDebts";
export { simplifyDebts, type Debt } from "@aviary/shared/balances/simplify";
// etc.
```
This way existing web imports don't need to change. We can clean this up later.

---

## 3. Mobile App Architecture

### Tech Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Expo SDK 52** (managed workflow) | Industry standard. Handles builds, OTA updates, device APIs. No native code to manage. |
| Routing | **Expo Router v4** | File-based routing, same mental model as Next.js App Router. Deep linking built-in. |
| Styling | **NativeWind v4** (Tailwind for RN) | Reuse exact same design tokens (stone-*, amber-*, etc.). Same className mental model. Compiles to native StyleSheet. |
| Server state | **TanStack Query v5** | Caching, background refetch, optimistic updates, infinite scroll. Perfect for the expense list pattern. |
| Auth storage | **expo-secure-store** | Encrypted key-value store for Supabase session tokens. |
| Supabase client | **@supabase/supabase-js** + custom auth storage | Full Supabase client — auth, reads, and RPC calls. Uses SecureStore instead of cookies. |
| Icons | **Lucide React Native** | Consistent icon set, tree-shakeable. |
| Haptics | **expo-haptics** | Tactile feedback for button presses, swipe actions. |
| Date picker | **@react-native-community/datetimepicker** | Native OS date pickers. |
| Bottom sheets | **@gorhom/bottom-sheet** | iOS-style bottom sheets for modals (add expense, etc.). |

### Data Architecture (Direct to Supabase)

Both web and mobile talk directly to Supabase. The Supabase JS client handles auth, RLS enforces read access, and RPC functions handle atomic mutations.

```
Web App     → Supabase JS client (cookies via @supabase/ssr) → Supabase (RLS + RPC)
Mobile App  → Supabase JS client (SecureStore)               → Supabase (RLS + RPC)
```

No intermediary. No CORS. No Bearer token plumbing. Both clients use the same Supabase project, same RPCs, same RLS policies.

**Why direct Supabase instead of a custom API layer?**

An audit of all 17 API routes revealed that only 2 genuinely require server authority (admin key or secrets). The rest are:
- **Atomic RPCs** the client can call directly (`create_expense`, `update_expense`, `delete_expense`, `create_payment`, `leave_group`, `create_group`, `join_group_by_token`)
- **RLS-protected reads** the client can query directly (groups, expenses, activity logs, balances)
- **Default resolution** (e.g., "paidById defaults to current user") that the client already knows
- **Display name lookups** the client already has in local state
- **Change diff computation** that we're extracting to `@aviary/shared` anyway

Adding a custom API layer would mean: another thing to deploy/monitor, duplicated security checks, added latency (client → server → Supabase), and over-engineering for this app's complexity.

**What the client needs to do (that the API routes currently do):**

| API route responsibility | Who does it in the new world? |
|---|---|
| Auth check | Supabase client handles auth. RPCs check `auth.uid()` internally. |
| Membership check | RPCs verify membership internally. RLS enforces on reads. |
| Zod validation | Client validates before calling RPC. Supabase rejects bad types. |
| Default paidById to current user | Client already knows the current user |
| Default participantIds to all members | Client already has the member list |
| Look up display names for RPCs | Client already has these in local state. Shared `rpcParams.ts` builds the payload. |
| Compute change diffs for expense edits | Shared `activityDiff.ts` (extracted from the 3 current duplicates) |
| Call the RPC | Client calls directly via `supabase.rpc()` |

**Mobile reads (queries):**
```ts
// Fetch user's groups — RLS ensures only groups the user belongs to
const { data } = await supabase
  .from("GroupMember")
  .select("Group(*)")
  .eq("userId", user.id)
  .order("createdAt", { ascending: false });

// Fetch group expenses with splits
const { data } = await supabase
  .from("Expense")
  .select("*, User!Expense_paidById_fkey(*), ExpenseSplit(*, User(*))")
  .eq("groupId", groupId)
  .order("date", { ascending: false });
```

**Mobile mutations (RPCs):**
```ts
import { buildCreateExpenseParams } from "@aviary/shared/rpcParams";

// Client builds params from data it already has
const params = buildCreateExpenseParams({
  groupId, description, amountCents, date, paidById,
  participantIds, members, splitType, splitAmounts,
});

// Direct RPC call — atomic, auth-checked, activity-logged
const { data, error } = await supabase.rpc("create_expense", params);
```

### Operations That Require Server Authority

Only **2 operations** cannot be done from the client:

| Operation | Why server-only? | Solution |
|---|---|---|
| **Account deletion** | Needs `SUPABASE_SERVICE_ROLE_KEY` to delete the auth user via `admin.auth.admin.deleteUser()` | **Supabase Edge Function** — client calls `delete_account` RPC (cleans up app data), then invokes Edge Function to delete auth record |
| **Recurring expense cron** | Needs `CRON_SECRET` + service role key to process recurring expenses system-wide | **Supabase Edge Function** or keep existing Next.js API route (not called by clients — triggered by external cron) |

For **add member by email** (currently requires server-side email lookup since RLS doesn't expose the User table for arbitrary email queries): create a new RPC `add_member_by_email(_group_id, _email)` that does the lookup + validation + insert atomically as SECURITY DEFINER. This eliminates the need for a server intermediary.

**Long-term vision:** Eventually migrate the web app to also talk directly to Supabase, removing the Next.js API routes entirely. The web app already uses the Supabase JS client for auth — extending it to data access is straightforward. The API routes become dead code once both clients use the shared RPC param builders.

---

## 4. Screen Map & Navigation

### Navigation Structure

```
Root (Expo Router)
├── (auth)/                     # Unauthenticated stack
│   ├── login.tsx               # Email/password + Google sign-in
│   └── signup.tsx              # Sign up + "check your email" state
├── (app)/                      # Authenticated tab navigator
│   ├── _layout.tsx             # Tab bar: Dashboard, Settings
│   ├── (dashboard)/
│   │   ├── index.tsx           # Group list + balance summary
│   │   └── create-group.tsx    # Create group (modal presentation)
│   ├── groups/
│   │   └── [id]/
│   │       ├── index.tsx       # Group detail (balances, expenses, activity)
│   │       ├── add-expense.tsx # Add expense (modal/sheet)
│   │       ├── expense/[expenseId].tsx  # Expense detail (edit/delete)
│   │       ├── record-payment.tsx       # Record payment (modal/sheet)
│   │       ├── add-member.tsx  # Add member (modal/sheet)
│   │       └── settings.tsx    # Group settings (rename, banner, leave)
│   ├── invite/
│   │   └── [token].tsx         # Invite preview + join
│   └── settings/
│       └── index.tsx           # Account settings, delete account
├── _layout.tsx                 # Root layout: providers (QueryClient, Auth, Theme)
└── +not-found.tsx              # 404
```

### Screen-by-Screen Breakdown

#### Auth Screens

**Login Screen**
- Email + password fields
- Google Sign-In button (native flow via `expo-auth-session`)
- "Sign up" link
- Deep link support for redirect after auth: `aviary://auth/callback`
- Branded header with bird emoji + warm gradient (matching web)

**Signup Screen**
- Email + password + display name
- Submit → "Check your email" confirmation UI
- Link back to login

**Auth Callback (deep link handler)**
- Handles `aviary://auth/callback?code=...` from email confirmation
- Exchanges code for session, redirects to dashboard

#### Main Screens

**Dashboard (group list)**
- Pull-to-refresh
- Hero card with total balance ("You are owed $X.XX" / "You owe $X.XX")
- Group list: thumbnail (SVG pattern rendered via react-native-svg), name, member count, balance
- FAB or header button → create group
- Bird fact card at bottom
- Empty state with friendly onboarding

**Group Detail**
- Banner hero (uploaded image or generated SVG pattern)
- Member pills (horizontal scroll)
- Invite link button (copy to clipboard / native share sheet)
- **Balances section:** who owes whom, with color-coded amounts
- **Expenses tab:** scrollable list with expense cards
  - Swipe-to-delete on own expenses
  - Tap → expense detail
  - FAB → add expense
- **Activity tab:** feed with relative timestamps, paginated (infinite scroll)
- "Record Payment" button
- "Leave Group" (with balance check)

**Add Expense (bottom sheet or full-screen modal)**
- Description field
- Amount field with formatted input (commas, 2 decimals)
- Native date picker
- Payer dropdown (group members)
- Participant checkboxes with equal/custom/percentage split modes
- Custom split: per-person dollar amounts
- Percentage split: per-person percentages
- Running total validation (must sum to expense total)

**Expense Detail**
- Full expense info: description, amount, date, payer, split breakdown
- Edit button (if creator) → inline edit or navigate to edit screen
- Delete button (if creator) → confirmation dialog
- Payment display variant (shows "from → to" instead of description)

**Record Payment (bottom sheet)**
- Amount field
- Date picker
- "From" dropdown (defaults to current user)
- "To" dropdown (other member)

**Settings**
- Display name
- Email (read-only)
- Dark mode toggle (follows system or manual)
- Delete account with confirmation + balance warnings

**Invite Screen**
- Group name + member count preview (via `get_group_by_invite_token` RPC)
- "Join this group" button
- Already a member → redirect to group

---

## 5. Auth Flow (Mobile)

Mobile uses the Supabase JS client for **everything** — auth, reads, and RPC mutations. The client is initialized with SecureStore for encrypted session persistence.

```ts
// mobile/lib/supabase.ts — full Supabase client (auth + data + RPCs)
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@aviary/shared/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle deep links manually
  },
});
```

**Auth state management:** A React context provider wraps the app, listens to `supabase.auth.onAuthStateChange`, and provides `user` + `session` + `loading` to all screens. The root layout redirects:
- No session → auth stack
- Session → app tabs

Supabase handles token refresh automatically. The client's auth state is tied to the session in SecureStore — no separate token management needed.

**Google Sign-In:** Use `expo-auth-session` with Supabase's Google provider. The OAuth flow opens in-app browser, callback returns to the app via deep link.

**Deep linking config:**
```json
// app.json
{
  "scheme": "aviary",
  "ios": { "bundleIdentifier": "com.gregbigelow.aviary" },
  "android": { "package": "com.gregbigelow.aviary" }
}
```

Invite links (`https://aviary.gregbigelow.com/invite/TOKEN`) use universal links / app links to open directly in the mobile app when installed.

---

## 6. UI/Design System

### NativeWind + Shared Design Tokens

NativeWind v4 lets us write `className="bg-stone-50 text-amber-600 rounded-xl"` in React Native components. The design tokens (colors, spacing, radii) are identical to the web app.

**Tailwind config for mobile:**
```js
// mobile/tailwind.config.js
module.exports = {
  content: ["./app/**/*.tsx", "./components/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        // Same warm palette as web
      },
      fontFamily: {
        sans: ["Geist"],          // Bundled via expo-font
        "serif-logo": ["Cormorant-Garamond"],
      },
    },
  },
};
```

### Native Adaptations

While we share design tokens, the mobile app should feel truly native:

| Web Pattern | Mobile Adaptation |
|-------------|-------------------|
| Modals with backdrop blur | Bottom sheets (iOS-style, drag to dismiss) |
| Page transitions | Stack navigator push/pop with native gestures |
| Hover states | Press states with haptic feedback |
| Click → `active:scale-[0.97]` | `Pressable` with `onPressIn`/`onPressOut` scale animation |
| Scroll containers | `FlatList` / `SectionList` with pull-to-refresh |
| Date input `<input type="date">` | Native date picker (`@react-native-community/datetimepicker`) |
| `window.clipboard` | `expo-clipboard` + native share sheet |
| Toast notifications | `expo-notifications` or `react-native-toast-message` |
| Dark mode via CSS `dark:` | NativeWind dark mode + `useColorScheme()` |

### Component Library (mobile/components/)

Build mobile-specific components that match the web design language:

```
mobile/components/
  ui/
    Button.tsx          # Pressable with amber primary, scale animation, haptics
    Card.tsx            # Warm card with stone border, shadow
    Input.tsx           # Styled TextInput with label, error state
    BottomSheet.tsx     # Wrapper around @gorhom/bottom-sheet
    Avatar.tsx          # Member emoji/image with color background
    MemberPill.tsx      # Compact member chip (reuses web colors)
    LoadingSpinner.tsx  # Amber-colored activity indicator
  GroupCard.tsx         # Dashboard group row
  ExpenseCard.tsx       # Expense list item (swipeable)
  BalanceCard.tsx       # Who-owes-whom display
  ActivityItem.tsx      # Activity feed row
```

---

## 7. State Management

### TanStack Query Setup

```ts
// mobile/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s before refetch
      gcTime: 5 * 60_000,     // 5min cache
      retry: 2,
      refetchOnWindowFocus: true,  // Refetch when app comes to foreground
    },
  },
});
```

### Query Keys & Hooks

```ts
// mobile/lib/queries/groups.ts
import { supabase } from "../supabase";

export const groupKeys = {
  all: ["groups"] as const,
  detail: (id: string) => ["groups", id] as const,
  expenses: (id: string) => ["groups", id, "expenses"] as const,
  balances: (id: string) => ["groups", id, "balances"] as const,
  activity: (id: string) => ["groups", id, "activity"] as const,
};

export function useGroups() {
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("GroupMember")
        .select("Group(*)")
        .order("createdAt", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: groupKeys.expenses(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Expense")
        .select("*, User!Expense_paidById_fkey(*), ExpenseSplit(*, User(*))")
        .eq("groupId", groupId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Optimistic Updates

TanStack Query's `useMutation` with `onMutate` for optimistic updates (same UX as the web app's manual optimistic state):

```ts
import { buildCreateExpenseParams } from "@aviary/shared/rpcParams";

export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input) => {
      const params = buildCreateExpenseParams(input);
      const { data, error } = await supabase.rpc("create_expense", params);
      if (error) throw error;
      return data;
    },
    onMutate: async (newExpense) => {
      await queryClient.cancelQueries({ queryKey: groupKeys.expenses(groupId) });
      const previous = queryClient.getQueryData(groupKeys.expenses(groupId));
      queryClient.setQueryData(groupKeys.expenses(groupId), (old) => [
        { ...newExpense, id: "temp-" + Date.now(), isPending: true },
        ...old,
      ]);
      return { previous };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(groupKeys.expenses(groupId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.expenses(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.balances(groupId) });
    },
  });
}
```

---

## 8. Implementation Phases

### Phase 1: Monorepo Setup & Shared Package (this session)

1. Configure npm workspaces in root `package.json`
2. Create `packages/shared/` with package.json, tsconfig
3. Move pure TS files from `lib/` → `packages/shared/src/`
4. Set up re-exports in `lib/` so web imports don't break
5. Move tests alongside shared code
6. Extract Zod validation schemas from API routes → `packages/shared/src/validation.ts`
7. Extract shared TypeScript types → `packages/shared/src/types.ts`
8. Extract activity diff computation → `packages/shared/src/activityDiff.ts` (consolidates 3 duplicates)
9. Create RPC param builders → `packages/shared/src/rpcParams.ts`
10. Run `SKIP_SMOKE_TESTS=1 npm test` and `npm run build` to verify web still works

### Phase 2: Database Changes for Direct Client Access

1. Create `add_member_by_email(_group_id, _email)` RPC — SECURITY DEFINER function that does email lookup + validation + insert atomically (replaces the API route that needed server-side email lookup)
2. Create `delete_auth_user()` Supabase Edge Function — accepts authenticated request, calls `admin.auth.admin.deleteUser()` (the only operation requiring the service role key that clients trigger)
3. Migration: `npx supabase db push`
4. Test new RPC from Supabase dashboard
5. Verify existing web app still works (API routes unchanged for now)

### Phase 3: Expo App Scaffold

1. `npx create-expo-app mobile --template blank-typescript`
2. Configure Metro for monorepo (resolve `@aviary/shared`)
3. Install dependencies: NativeWind, TanStack Query, expo-secure-store, etc.
4. Set up Supabase client with SecureStore (full client — auth + data + RPCs)
5. Configure Expo Router file structure
6. Set up NativeWind with matching design tokens
7. Bundle Geist + Cormorant Garamond fonts via expo-font
8. Create root layout with providers (Auth, Query, Theme)

### Phase 4: Auth Screens

1. Login screen (email/password)
2. Signup screen
3. Auth state provider + session management
4. Deep link handler for email confirmation
5. Google Sign-In via expo-auth-session
6. Protected route wrapper (redirect to login if no session)

### Phase 5: Dashboard & Group List

1. Dashboard screen with group list
2. Group card component with SVG pattern thumbnail (via react-native-svg)
3. Balance summary hero
4. Create group modal/screen
5. Pull-to-refresh
6. Empty state
7. Bird fact card

### Phase 6: Group Detail

1. Group detail screen with banner
2. Member pills (horizontal scroll)
3. Invite link (share sheet)
4. Balances section
5. Expenses list (FlatList with card items)
6. Activity feed (paginated, infinite scroll)
7. Expense card component (tap for detail, swipe to delete)

### Phase 7: Expense CRUD

1. Add expense bottom sheet/modal
2. Amount input with formatting
3. Native date picker
4. Payer selection
5. Participant selection with equal/custom/percentage splits
6. Edit expense screen
7. Delete expense with confirmation
8. Optimistic updates for all mutations

### Phase 8: Payments & Members

1. Record payment sheet
2. Add member form (calls `add_member_by_email` RPC)
3. Leave group (with balance check, confirmation)
4. Group settings (rename, banner upload)

### Phase 9: Settings & Polish

1. Settings screen (display name, email display)
2. Delete account with confirmation + balance warnings (calls `delete_account` RPC + Edge Function)
3. Dark mode (system + manual toggle)
4. Push notification setup (future — just the plumbing)
5. Universal links for invite URLs
6. App icon + splash screen
7. Animations and haptic feedback polish
8. Error boundaries and offline state handling

### Phase 10: Testing

1. Unit tests for shared package (already moved from web)
2. Component tests for mobile screens (React Native Testing Library)
3. Integration tests for Supabase queries + RPCs
4. E2E tests with Detox or Maestro

### Phase 11: Build & Distribution

1. EAS Build configuration (`eas.json`)
2. App store metadata (screenshots, description)
3. TestFlight + Google Play internal testing
4. OTA updates via `expo-updates`

---

## 9. Key Technical Decisions

### Why Expo over bare React Native?
- Managed workflow eliminates native build complexity
- EAS Build handles iOS/Android builds in the cloud
- OTA updates via expo-updates (deploy without app store review)
- expo-router gives us file-based routing (matches Next.js mental model)
- Built-in support for fonts, icons, secure storage, haptics, etc.

### Why NativeWind over other styling?
- Same Tailwind class names as the web app — less cognitive switching
- Design tokens (colors, spacing, radii) stay in sync automatically
- Compiles to native StyleSheet at build time (good performance)
- Active ecosystem, well-maintained

### Why direct Supabase instead of a custom API layer?

An audit of all 17 Next.js API routes revealed that **only 2 require server authority** (admin key or cron secret). The other 15 are:

- **Atomic RPCs** the client can call directly — `create_expense`, `update_expense`, `delete_expense`, `create_payment`, `leave_group`, `create_group`, `join_group_by_token`. These already handle auth checks, membership verification, and activity logging internally.
- **RLS-protected reads** the client can query directly — groups, expenses, activity logs, members.
- **Default resolution** the client already knows — "paidById defaults to current user", "participantIds defaults to all members."
- **Display name lookups** the client already has in local state — shared `rpcParams.ts` builders handle the mapping.
- **Change diff computation** we're extracting to `@aviary/shared/activityDiff.ts` anyway — consolidating 3 duplicated implementations into one.

A custom API layer would mean:
- Another service to deploy, monitor, and scale
- Duplicated security checks (RPCs already verify auth + membership)
- Added latency (client → your server → Supabase vs client → Supabase)
- CORS configuration headaches
- Bearer token plumbing
- Over-engineering for this app's complexity level

The migration path is clean: mobile starts direct-to-Supabase from day one. Web continues using API routes for now (they work fine). Eventually, web migrates to the same pattern, and the API routes are deleted.

### Why TanStack Query?
- Built-in caching, background refetching, optimistic updates
- Replaces the manual `useState` + `router.refresh()` pattern on web with something more robust
- `useInfiniteQuery` is perfect for the paginated activity feed
- Mutation lifecycle (`onMutate`, `onError`, `onSettled`) maps cleanly to optimistic patterns

### Database types: shared or duplicated?
Move `lib/supabase/database.types.ts` to `packages/shared/src/types/database.ts` so both web and mobile import from the same source. The `npm run db:types` script updates this single file.

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Web app breaks during monorepo migration | Re-export barrels in `lib/` preserve all existing imports. Full test suite + build verification after each step. |
| Metro bundler conflicts with Next.js tooling | Separate config files. Metro only resolves `mobile/` and `packages/`. Next.js turbopack ignores `mobile/`. |
| NativeWind compatibility issues | NativeWind v4 is stable with Expo SDK 52. Fallback: use StyleSheet directly for complex cases. |
| Supabase auth session management on mobile | Well-documented pattern with expo-secure-store. Supabase JS client has first-class support for custom storage adapters. |
| SVG pattern rendering on mobile | Use `react-native-svg` to render the existing pattern generators. The generators output SVG strings — we parse and render natively. |
| App store review delays | Ship to TestFlight/internal testing first. Use OTA updates for quick iteration post-launch. |
| Supabase query complexity on client | TanStack Query handles caching, deduplication, and background refetching. Complex queries (group detail with nested relations) are well-supported by Supabase's PostgREST API. |
| Client-side display name lookups for RPCs | Shared `rpcParams.ts` builders ensure both platforms construct identical payloads. If a member isn't in local state (departed user), falls back to "Unknown" — same as today. |

---

## 11. Files to Modify in Existing Web App

Minimal changes to the web app during Phase 1:

1. **`package.json`** — Add `"workspaces"` field
2. **`tsconfig.json`** — Add path alias for `@aviary/shared`
3. **`next.config.ts`** — Add `transpilePackages: ["@aviary/shared"]`
4. **`lib/balances/*.ts`** — Become re-export barrels (or update imports project-wide)
5. **`lib/format.ts`** — Becomes re-export barrel
6. **`lib/formatDisplayName.ts`** — Becomes re-export barrel
7. **`lib/constants.ts`** — Becomes re-export barrel
8. **`lib/amount.ts`** — Becomes re-export barrel
9. **`lib/percentageSplit.ts`** — Becomes re-export barrel
10. **`lib/groupPattern.ts`** — Becomes re-export barrel

**No changes to:**
- Existing API route handlers (web continues using them as-is)
- `lib/supabase/server.ts` (no Bearer token support needed)
- `next.config.ts` CORS headers (no cross-origin requests)
- Components, pages, or Supabase RPC functions

**New database migration (Phase 2):**
- `add_member_by_email` RPC function
- `delete_auth_user` Supabase Edge Function
