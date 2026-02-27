# Mobile UI Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken inputs, redesign the ExpenseForm and all major screens to match/exceed the mobile web app in quality and polish.

**Architecture:** All UI work lives in `mobile/`. Shared business logic stays in `@aviary/shared`. Each task is a self-contained screen or component change. All agents must invoke the `frontend-design` skill for any visual work.

**Tech Stack:** Expo SDK 54, Expo Router v6, NativeWind v4, React Native, TanStack Query v5, Reanimated v3, react-native-svg, @gorhom/bottom-sheet.

**Key bug note:** `ExpenseForm` has a double-nested `KeyboardAvoidingView` — the form itself wraps in a KAV, and every screen that uses it (`add-expense.tsx`, `add-friend-expense.tsx`) also wraps in a KAV. This causes iOS to briefly steal focus when tapping the description field (the "orange bar flash" bug). The fix is to remove the inner `KeyboardAvoidingView` from `ExpenseForm` and replace with a plain `View`. Also, step 0 has no `ScrollView`, so the description field gets cut off under the keyboard — wrap step 0 content in `<ScrollView keyboardShouldPersistTaps="handled">`.

**Note on `&apos;`**: React Native JSX does not render HTML entities. Replace `What&apos;s it for?` with `What's it for?`.

---

## Task 1: Fix and Redesign ExpenseForm

**Goal:** Fix broken input focus, then full UI redesign to match the mobile web app's add-expense flow.

**Files:**
- Modify: `mobile/components/ExpenseForm.tsx`
- Modify: `mobile/components/ExpenseForm.test.tsx`

**Reference:** The mobile web add expense flow at `app/(app)/groups/[id]/AddExpenseForm.tsx`. The mobile web has a clean 3-step flow: (1) amount + description big and centered, (2) paid-by + split options, (3) custom/percentage splits. Match this aesthetic — generous whitespace, large typography for the amount, clear step progression.

**Step 1: Fix the double-nested KeyboardAvoidingView**

In `ExpenseForm.tsx`, the `return (...)` currently wraps everything in:
```jsx
<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
```
Replace this with a plain `<View style={{ flex: 1 }}>`. Remove `KeyboardAvoidingView` and `Platform` from the imports if no longer used elsewhere in the file.

**Step 2: Wrap step 0 content in ScrollView**

`renderQuickEntry()` currently returns `<View className="flex-1 px-5">`. Change to:
```jsx
<ScrollView
  className="flex-1"
  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
```

**Step 3: Fix HTML entity**

Replace `What&apos;s it for?` with `What's it for?`.

**Step 4: Add `initialData` prop support (needed for edit flow)**

Add to `ExpenseFormProps`:
```ts
initialData?: {
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  paidById: string;
  participantIds: string[];
  splitType: "equal" | "custom";
  splitAmounts?: number[]; // parallel to participantIds, only when custom
}
```

Use `initialData` as the initial `useState` values:
```ts
const [description, setDescription] = useState(initialData?.description ?? "");
const [amount, setAmount] = useState(
  initialData?.amountCents
    ? formatAmountDisplay(String(initialData.amountCents / 100))
    : ""
);
const [date, setDate] = useState(
  initialData?.date ? new Date(initialData.date + "T12:00:00") : new Date()
);
const [paidById, setPaidById] = useState<string | null>(initialData?.paidById ?? null);
const [participantIds, setParticipantIds] = useState<Set<string>>(
  initialData?.participantIds ? new Set(initialData.participantIds) : new Set()
);
const [splitType, setSplitType] = useState<SplitType>(
  initialData?.splitType === "custom" ? "custom" : "equal"
);
```

For custom split amounts, initialize `customAmounts` from `initialData.splitAmounts` in the existing `initialized.current` guard block.

**Step 5: Full UI redesign using `frontend-design` skill**

Use the `frontend-design` skill. Design goals:
- Step 0: Giant centered amount input (like web: huge dollar amount, clean sans-serif), below it a clean description input, below that a minimal date row. All on a clean white/stone background.
- Step 1: "Paid by" horizontal pill selector, "Split between" checklist rows with per-person amounts shown for equal splits, split type toggle (Equal / Custom / %).
- Step 2 (custom/percentage): Per-person amount inputs, running total validation bar.
- Bottom bar: step indicator dots, Back/Next/Submit buttons.
- Remove the float animation from the Submit button if present.

**Step 6: Run tests**
```bash
cd mobile && timeout 30 npx vitest run components/ExpenseForm.test.tsx --config vitest.config.ts
```

**Step 7: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```

**Step 8: Commit**
```bash
git add mobile/components/ExpenseForm.tsx mobile/components/ExpenseForm.test.tsx
git commit -m "Mobile: fix ExpenseForm input focus bug and redesign to match web"
```

---

## Task 2: Fix SVG Group Cover Photos + Remove Accent Line

**Goal:** Group banner headers should show the SVG pattern when no photo is uploaded. Remove the colored accent line.

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/index.tsx`

**Context:** `GroupBannerHeader` in `index.tsx` uses `getGroupColor(patternSeed)` for a solid color background when there's no `bannerUrl`, but never renders the SVG pattern. `GroupThumbnail` already does it correctly using `SvgXml` + `generateGroupPattern`. Copy that approach into the banner. Also remove the accent line `<View style={{ height: 3, backgroundColor: groupColor.accent }} />` — it looks like a bug.

**Step 1: Import what's needed**

Add to imports at top of `index.tsx`:
```ts
import { SvgXml } from "react-native-svg";
import { generateGroupPattern } from "../../../../lib/queries/shared";
```
(Verify these are the correct import paths by checking `GroupThumbnail.tsx`.)

**Step 2: Update the no-banner case in `GroupBannerHeader`**

In the `return (...)` for the non-banner case (the `<View style={{ height: 160, overflow: "hidden" }} testID="banner-color">` block), render the SVG pattern as an absolutely-positioned background:

```jsx
return (
  <View style={{ height: 160, overflow: "hidden" }} testID="banner-color">
    <View style={{ flex: 1, backgroundColor: groupColor.bg }}>
      {/* SVG pattern as background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none">
        <SvgXml xml={generateGroupPattern(patternSeed, 160)} width="100%" height="100%" />
      </View>
      {headerContent}
    </View>
    {/* Remove the accent line entirely — delete this View */}
  </View>
);
```

**Step 3: Run affected test**
```bash
cd mobile && timeout 30 npx vitest run app/\(app\)/groups/\[id\]/index.test.tsx --config vitest.config.ts
```

**Step 4: Commit**
```bash
git add mobile/app/\(app\)/groups/\[id\]/index.tsx
git commit -m "Mobile: render SVG pattern in group banner, remove accent line"
```

---

## Task 3: Redesign Balance Summary Card

**Goal:** Remove the left colored bar; polish the balance card to feel premium.

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/index.tsx`

**Use `frontend-design` skill.**

**Design direction:**
- Remove `<View className={\`w-1.5 rounded-l-xl \${accentColor}\`} />` entirely.
- The card itself should subtly tint based on balance direction: a very light emerald tint when owed money, rose tint when owing, neutral when settled. Achieve with `backgroundColor` style prop.
- Large bold balance text. Net balance amount displayed prominently. Debt lines shown below when expanded.
- The expand/collapse chevron stays. Animate it with a smooth rotation using Reanimated.
- Overall: think "premium fintech card" — clean, confident, no decorative bars.

**Step 1: Redesign the card (frontend-design skill)**

**Step 2: Run tests**
```bash
cd mobile && timeout 30 npx vitest run app/\(app\)/groups/\[id\]/index.test.tsx --config vitest.config.ts
```

**Step 3: Commit**
```bash
git add mobile/app/\(app\)/groups/\[id\]/index.tsx
git commit -m "Mobile: redesign balance summary card, remove left accent bar"
```

---

## Task 4: Redesign Expense List Items + Add Inline "Add Expense" Button + FAB

**Goal:** Mirror web expense list item design exactly. Add inline "Add expense" button above expenses. Add circular FAB that appears when inline button scrolls out of view. Remove "Recurring" button from action island. Simplify action island to just "Settle Up".

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/index.tsx`

**Use `frontend-design` skill.**

**Expense list items — design notes:**
- Mirror the web app exactly. Date badge on left (month abbrev + day number, stone-100 background). Description bold + subtitle. Context label ("You lent $X" emerald, "You owe $X" rose). Amount + circular icon badge on right.
- Increase text sizes: description 16–17sp, subtext 13–14sp.

**Inline "Add expense" button:**
- Full-width amber button, placed between the balance card and the "Expenses" section header.
- Measure its Y position with `onLayout`: `const [inlineAddY, setInlineAddY] = useState(0)`.
- Track scroll offset with `onScroll` (throttle to 16ms): `const [scrollY, setScrollY] = useState(0)`.
- FAB visible when `scrollY > inlineAddY + 56` (button has scrolled off the top).

**Circular FAB:**
- Small amber circle with `+` icon, position `absolute` bottom-right, above the action island.
- Fade + scale in/out with Reanimated when FAB visibility changes.
- `bottom: insets.bottom + 70` (above the settle up island), `right: 16`.

**Action island:**
- Remove the "Recurring" button entirely.
- Remove the float/bounce animation on the Add button.
- Island now contains only "Settle Up" — full-width pill, emerald style.

**Step 1: Implement all changes (frontend-design skill)**

**Step 2: Run tests**
```bash
cd mobile && timeout 30 npx vitest run app/\(app\)/groups/\[id\]/index.test.tsx --config vitest.config.ts
```

**Step 3: Commit**
```bash
git add mobile/app/\(app\)/groups/\[id\]/index.tsx
git commit -m "Mobile: redesign expense items, add inline add button + FAB, simplify action island"
```

---

## Task 5: Redesign Expense Detail Page + Create Edit Screen

**Goal:** Polish the expense detail view. Add a new edit screen that reuses `ExpenseForm` with `initialData`.

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/expense/[expenseId].tsx`
- Create: `mobile/app/(app)/groups/[id]/expense/[expenseId]/edit.tsx`
- Modify: `mobile/app/(app)/groups/[id]/expense/[expenseId].tsx` (edit button navigates to new screen)

**Note:** Creating `edit.tsx` inside a folder named `[expenseId]` requires moving the current `[expenseId].tsx` to `[expenseId]/index.tsx` first. Check Expo Router conventions — nested dynamic routes. The current file is `expense/[expenseId].tsx`. The edit screen should be `expense/[expenseId]/edit.tsx`, which means the detail screen must become `expense/[expenseId]/index.tsx`.

**Step 1: Rename detail screen**
```bash
mkdir -p mobile/app/\(app\)/groups/\[id\]/expense/\[expenseId\]
mv mobile/app/\(app\)/groups/\[id\]/expense/\[expenseId\].tsx \
   mobile/app/\(app\)/groups/\[id\]/expense/\[expenseId\]/index.tsx
mv mobile/app/\(app\)/groups/\[id\]/expense/\[expenseId\].test.tsx \
   mobile/app/\(app\)/groups/\[id\]/expense/\[expenseId\]/index.test.tsx
```
Update any relative imports inside those files accordingly.

**Step 2: Redesign detail view (frontend-design skill)**

Design goals:
- Hero area at top: large centered amount in amber, description in bold, recurring badge if applicable.
- Details card: date, paid by ("you" when current user), split type.
- Split breakdown card: each participant row with name, "(you)" marker, "paid" badge, and amount.
- Delete button: full-width destructive pressable at the bottom of the scroll.
- Edit button in header (pencil icon) → navigates to `./edit`.
- Remove inline edit mode entirely — the edit screen handles it.

**Step 3: Create edit screen**

`mobile/app/(app)/groups/[id]/expense/[expenseId]/edit.tsx`:
- Reads `expenseId` and `id` from `useLocalSearchParams`.
- Loads `useGroupExpenses(id)` and `useGroupDetail(id)` to get the expense + members.
- Extracts `initialData` from the expense: `{ description, amountCents, date, paidById, participantIds, splitType, splitAmounts }`.
- Renders `ExpenseForm` with `initialData`, `members`, `currentUserId`, `isLoading={updateExpense.isPending}`, `submitLabel="Save changes"`, `showRecurring={false}`.
- On submit: calls `updateExpense.mutateAsync(...)` then `router.back()`.
- Header: "Edit expense" title + Cancel on left.

**Step 4: Run tests**
```bash
cd mobile && timeout 30 npx vitest run "app/\(app\)/groups/\[id\]/expense" --config vitest.config.ts
```

**Step 5: Commit**
```bash
git commit -m "Mobile: redesign expense detail, add edit screen using ExpenseForm"
```

---

## Task 6: Redesign Activity Drawer

**Goal:** Fix the cut-off close button and small text. Full redesign of the bottom sheet content.

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/index.tsx` (`ActivitySheetContent` component)

**Use `frontend-design` skill.**

**Design goals:**
- Title: 17px semibold.
- Detail label/value rows: 15px.
- Timestamp + actor: 13px.
- Close button: always above `insets.bottom`. Use `useSafeAreaInsets()` inside `ActivitySheetContent` and add `paddingBottom: insets.bottom + 8` to the bottom button container.
- Sheet snap points: `["45%", "75%"]` — ensure enough space for content + close button.
- Close button: full-width, solid stone border, clearly tappable.

**Step 1: Redesign (frontend-design skill)**

**Step 2: Commit**
```bash
git add mobile/app/\(app\)/groups/\[id\]/index.tsx
git commit -m "Mobile: redesign activity drawer, fix cut-off close button"
```

---

## Task 7: Redesign Group Settings + Fix Name Edit + Leave Group Enforcement

**Goal:** Fix broken group name edit form. Redesign settings to match web. Fix leave group to use a proper modal with debt info.

**Files:**
- Modify: `mobile/app/(app)/groups/[id]/settings.tsx`

**Use `frontend-design` skill.**

**Name edit bug:** The current code sets `editingName = true` and renders an `Input` inside a container. The bug is likely that `setNameInput(groupName ?? "")` is called correctly, but the `Input` component's `autoFocus` prop may not work inside a conditional render on all RN versions. Fix by using a `ref` + `focus()` call instead of relying on `autoFocus`:
```ts
const nameInputRef = useRef<TextInput>(null);
// when entering edit mode:
setEditingName(true);
setNameInput(groupName ?? "");
setTimeout(() => nameInputRef.current?.focus(), 100);
```
Pass `ref={nameInputRef}` through to the `TextInput` inside `Input` component (add `ref` forwarding to `Input` if not already there — use `React.forwardRef`).

**Leave group modal:** When `outstandingCents > 0`, don't just show a toast — show a custom Alert with a clear message:
```ts
Alert.alert(
  "Can't leave yet",
  `You have an outstanding balance of ${formatCents(outstandingCents)} in this group. Settle up before leaving.`,
  [{ text: "Got it", style: "cancel" }]
);
```

**Settings redesign:** Match the web group settings page:
- Clear section headers (Group Info, Members, Danger Zone).
- Banner preview with "Change" affordance.
- Share invite + Add member rows.
- Leave / Delete in danger zone with clear styling.
- Add a member count display.

**Step 1: Add `forwardRef` to `Input` component**

Modify `mobile/components/ui/Input.tsx` to use `React.forwardRef<TextInput, InputProps>`.

**Step 2: Fix name edit + leave modal + redesign settings (frontend-design skill)**

**Step 3: Run tests**
```bash
cd mobile && timeout 30 npx vitest run "app/\(app\)/groups/\[id\]/settings" --config vitest.config.ts
```

**Step 4: Commit**
```bash
git commit -m "Mobile: fix name edit, leave group modal, redesign group settings"
```

---

## Task 8: Dashboard Hero Image

**Goal:** Replace the flat amber card with the birds.jpg hero image + gradient, matching the web dashboard.

**Files:**
- Copy: `public/birds.jpg` → `mobile/assets/birds.jpg`
- Modify: `mobile/app/(app)/(dashboard)/index.tsx`

**Step 1: Copy the asset**
```bash
cp /Users/gregbigelow/workspace/aviary/public/birds.jpg \
   /Users/gregbigelow/workspace/aviary/mobile/assets/birds.jpg
```

**Step 2: Replace the hero card**

Remove the current amber `<Card className="mb-6 overflow-hidden rounded-2xl">` block. Replace with:
```jsx
<ImageBackground
  source={require("../../../assets/birds.jpg")}
  style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24 }}
  imageStyle={{ borderRadius: 16 }}
>
  <View style={{
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    borderRadius: 16,
  }}>
    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700",
                   letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
      Your balance
    </Text>
    <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>
      Hey {displayName}.
    </Text>
    {(groups ?? []).length > 0 && (
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, fontWeight: "600", marginTop: 6 }}>
        {totalBalance === 0
          ? "You're all settled up 🎉"
          : totalBalance > 0
            ? `You are owed ${formatCents(totalBalance)}`
            : `You owe ${formatCents(Math.abs(totalBalance))}`}
      </Text>
    )}
  </View>
</ImageBackground>
```

Add `ImageBackground` to the RN imports.

**Step 3: Run tests**
```bash
cd mobile && timeout 30 npx vitest run "app/\(app\)/\(dashboard\)/index" --config vitest.config.ts
```

**Step 4: Commit**
```bash
git add mobile/assets/birds.jpg mobile/app/\(app\)/\(dashboard\)/index.tsx
git commit -m "Mobile: replace dashboard hero card with birds.jpg image"
```

---

## Task 9: Dashboard Add Expense FAB + Picker Screen

**Goal:** Add a circular FAB on the dashboard that opens a picker screen to choose a group or friend, then navigates to add-expense.

**Files:**
- Modify: `mobile/app/(app)/(dashboard)/index.tsx` (add FAB)
- Create: `mobile/app/(app)/(dashboard)/add-expense-picker.tsx`
- Modify: `mobile/app/(app)/(dashboard)/add-friend-expense.tsx` (accept `friendId` param)

**Use `frontend-design` skill.**

**FAB:** Circular amber button, bottom-right, `position: absolute`, above safe area. Hidden when `groups.length === 0`. Navigates to `/(app)/(dashboard)/add-expense-picker`.

**Picker screen design:**
- Full-screen modal-style with a search bar auto-focused at top.
- Below: unified list showing all regular groups (with `GroupThumbnail`) and all friends (with `Avatar`). Filterable by name as user types.
- Section headers: "Groups" and "Friends".
- Each row shows name + balance.
- Tapping a group → `router.push('/(app)/groups/${groupId}/add-expense')`.
- Tapping a friend → `router.push('/(app)/(dashboard)/add-friend-expense?friendId=${userId}')`.

**Update `add-friend-expense.tsx`:**
- Read `friendId` from `useLocalSearchParams<{ friendId?: string }>()`.
- If `friendId` is present, initialize `selectedFriendId` state to that value instead of `null`.

**Step 1: Add FAB to dashboard (frontend-design skill)**

**Step 2: Create picker screen (frontend-design skill)**

**Step 3: Update add-friend-expense to accept friendId param**

**Step 4: Run tests**
```bash
cd mobile && timeout 30 npx vitest run "app/\(app\)/\(dashboard\)" --config vitest.config.ts
```

**Step 5: Commit**
```bash
git commit -m "Mobile: add dashboard add-expense FAB and picker screen"
```

---

## Task 10: App Settings — Back Button + Block Account Deletion with Debt

**Goal:** Add back button to app settings header. Block account deletion when user has outstanding debts.

**Files:**
- Modify: `mobile/app/(app)/settings/index.tsx`

**Use `frontend-design` skill.**

**Back button:** Add `ChevronLeft` back button to the settings screen header (check if it already has one — if missing, add it using the same pattern as `add-expense.tsx` header).

**Block deletion with debt:**
- `useGroups()` is already imported. Compute `const groupsWithDebt = (groups ?? []).filter(g => Math.abs(g.balanceCents) > 0)`.
- In the delete account handler, before showing the confirmation:
  ```ts
  if (groupsWithDebt.length > 0) {
    Alert.alert(
      "Can't delete account",
      `You have outstanding balances in ${groupsWithDebt.length} group${groupsWithDebt.length > 1 ? "s" : ""}. Settle up before deleting your account.`,
      [{ text: "Got it" }]
    );
    return;
  }
  ```
- Redesign the delete account section to clearly show the debt warning inline when debt exists (not just on tap).

**Step 1: Implement changes (frontend-design skill)**

**Step 2: Run tests**
```bash
cd mobile && timeout 30 npx vitest run "app/\(app\)/settings" --config vitest.config.ts
```

**Step 3: Commit**
```bash
git commit -m "Mobile: add settings back button, block account deletion with outstanding debt"
```

---

## Final Step: Full typecheck + push

```bash
# From repo root:
npx tsc --noEmit

# From mobile/:
cd mobile && npx tsc --noEmit

# Push to origin/main:
git fetch origin && git rebase origin/main && git push origin HEAD:main
```
