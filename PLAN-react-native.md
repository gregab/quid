# React Native Monorepo Plan

## Overview

Add a React Native (Expo) mobile app to the existing Aviary repo as a monorepo, sharing TypeScript business logic between the Next.js web app and the new mobile app. The mobile app will have full feature parity with the web app, designed to feel truly native on iOS and Android.

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
| Supabase client | **@supabase/supabase-js** + custom auth storage | Same client as web, but uses SecureStore instead of cookies. |
| Icons | **Lucide React Native** | Consistent icon set, tree-shakeable. |
| Haptics | **expo-haptics** | Tactile feedback for button presses, swipe actions. |
| Date picker | **@react-native-community/datetimepicker** | Native OS date pickers. |
| Bottom sheets | **@gorhom/bottom-sheet** | iOS-style bottom sheets for modals (add expense, etc.). |

### Data Architecture (Mobile → Supabase Direct)

The mobile app talks directly to Supabase — **not** through the Next.js API routes.

```
Mobile App → Supabase JS Client → Supabase (RLS + RPC functions)
```

**Why direct Supabase, not through the Next.js API?**
- The Next.js API routes are thin wrappers: Zod validate → Supabase RPC call → JSON response
- RLS already protects all data at the database layer
- RPC functions (`create_expense`, `update_expense`, etc.) handle all complex mutations atomically
- Eliminates an extra network hop and CORS configuration
- The Supabase JS client works identically in React Native
- Validation schemas extracted to `@aviary/shared` can be reused in both clients

**Service layer:** We'll create a thin service layer in `mobile/lib/services/` that mirrors what the API routes do:

```ts
// mobile/lib/services/expenses.ts
import { z } from "zod";
import { ExpenseInputSchema } from "@aviary/shared/validation";
import { supabase } from "../supabase";

export async function createExpense(groupId: string, input: z.infer<typeof ExpenseInputSchema>) {
  const validated = ExpenseInputSchema.parse(input);
  const { data, error } = await supabase.rpc("create_expense", { ... });
  if (error) throw error;
  return data;
}
```

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

Supabase auth in React Native uses a custom storage adapter instead of cookies:

```ts
// mobile/lib/supabase.ts
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
    queryFn: () => fetchGroups(),
  });
}

export function useGroupDetail(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => fetchGroupDetail(id),
  });
}
```

### Optimistic Updates

TanStack Query's `useMutation` with `onMutate` for optimistic updates (same UX as the web app's manual optimistic state):

```ts
export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => createExpense(groupId, input),
    onMutate: async (newExpense) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: groupKeys.expenses(groupId) });
      // Snapshot previous state
      const previous = queryClient.getQueryData(groupKeys.expenses(groupId));
      // Optimistically add the expense
      queryClient.setQueryData(groupKeys.expenses(groupId), (old) => [
        { ...newExpense, id: "temp-" + Date.now(), isPending: true },
        ...old,
      ]);
      return { previous };
    },
    onError: (err, _, context) => {
      // Rollback on error
      queryClient.setQueryData(groupKeys.expenses(groupId), context?.previous);
    },
    onSettled: () => {
      // Refetch to get server truth
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
8. Run `SKIP_SMOKE_TESTS=1 npm test` and `npm run build` to verify web still works

### Phase 2: Expo App Scaffold

1. `npx create-expo-app mobile --template blank-typescript`
2. Configure Metro for monorepo (resolve `@aviary/shared`)
3. Install dependencies: NativeWind, TanStack Query, expo-secure-store, etc.
4. Set up Supabase client with SecureStore
5. Configure Expo Router file structure
6. Set up NativeWind with matching design tokens
7. Bundle Geist + Cormorant Garamond fonts via expo-font
8. Create root layout with providers (Auth, Query, Theme)

### Phase 3: Auth Screens

1. Login screen (email/password)
2. Signup screen
3. Auth state provider + session management
4. Deep link handler for email confirmation
5. Google Sign-In via expo-auth-session
6. Protected route wrapper (redirect to login if no session)

### Phase 4: Dashboard & Group List

1. Dashboard screen with group list
2. Group card component with SVG pattern thumbnail (via react-native-svg)
3. Balance summary hero
4. Create group modal/screen
5. Pull-to-refresh
6. Empty state
7. Bird fact card

### Phase 5: Group Detail

1. Group detail screen with banner
2. Member pills (horizontal scroll)
3. Invite link (share sheet)
4. Balances section
5. Expenses list (FlatList with card items)
6. Activity feed (paginated, infinite scroll)
7. Expense card component (tap for detail, swipe to delete)

### Phase 6: Expense CRUD

1. Add expense bottom sheet/modal
2. Amount input with formatting
3. Native date picker
4. Payer selection
5. Participant selection with equal/custom/percentage splits
6. Edit expense screen
7. Delete expense with confirmation
8. Optimistic updates for all mutations

### Phase 7: Payments & Members

1. Record payment sheet
2. Add member form
3. Leave group (with balance check, confirmation)
4. Group settings (rename, banner upload)

### Phase 8: Settings & Polish

1. Settings screen (display name, email display)
2. Delete account with confirmation + balance warnings
3. Dark mode (system + manual toggle)
4. Push notification setup (future — just the plumbing)
5. Universal links for invite URLs
6. App icon + splash screen
7. Animations and haptic feedback polish
8. Error boundaries and offline state handling

### Phase 9: Testing

1. Unit tests for shared package (already moved from web)
2. Component tests for mobile screens (React Native Testing Library)
3. Integration tests for Supabase service layer
4. E2E tests with Detox or Maestro

### Phase 10: Build & Distribution

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

### Why direct Supabase instead of API routes?
- The API routes are thin wrappers — the real logic is in RPC functions
- Eliminates CORS, extra hop, and API route maintenance for mobile
- RLS protects data regardless of which client connects
- Same `@supabase/supabase-js` client works in RN

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

---

## 11. Files to Modify in Existing Web App

Minimal changes to the web app:

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

No changes to components, pages, API routes, or Supabase config.
