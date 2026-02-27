# Mobile UI Overhaul — Design Doc
**Date:** 2026-02-26

## Scope

Twelve distinct improvements to the mobile app, spanning bug fixes, feature additions, and UI redesigns. All agents must apply full React Native expertise — these screens should look polished and native, not generic.

---

## 1. Fix SVG Group Cover Photos (TASK-3 / TASK-5)

**Problem:** Group banner headers display a solid color instead of the SVG pattern, and an accent line appears below — sometimes shows as a jarring red/colored bar.

**Fix:**
- In `GroupBannerHeader` (`groups/[id]/index.tsx`), when no `bannerUrl` is set, render `SvgXml` with the `generateGroupPattern(patternSeed)` output, matching the `GroupThumbnail` approach.
- Remove the `<View style={{ height: 3, backgroundColor: groupColor.accent }} />` accent line entirely — it looks broken. The banner is visually terminated by the content below.

---

## 2. Redesign Balance Summary Section (TASK-9)

**Problem:** Left-side colored bar looks unpolished and dated.

**Design:** Full redesign by a frontend-design agent.
- Remove the left accent bar entirely.
- The balance card should feel premium: clean white card (dark: stone-900), large bold balance text centered or left-aligned, with a subtle tint/gradient hinting at the direction (owed=emerald, owing=rose, settled=neutral).
- Collapsible debt details stay — animate with Reanimated LayoutAnimation.
- Use the `frontend-design` skill.

---

## 3. Expense List Items Redesign (TASK-13)

**Problem:** Expense rows don't match the mobile web app's quality.

**Design:** Mirror the mobile web app exactly.
- Date badge (month + day) on the left — same as current native implementation, keep this.
- Description/title in bold, subtitle with "Paid by you/name".
- Context label: "You lent $X" (emerald) or "You owe $X" (rose).
- Right side: amount bold + circular icon badge (TrendingUp/TrendingDown/ArrowUpRight/ArrowDownLeft/Receipt) with tinted background — this already exists, keep it.
- Increase text sizes per TASK-12: description to 16–17px, subtext to 13–14px.
- Use `frontend-design` skill.

---

## 4. Expense Detail Page Redesign + Edit Flow (TASK-10)

**Problem:** Detail page is unpolished; edit mode is a bare 2-field inline form.

**Design:**
- Full view mode redesign via `frontend-design` skill: hero area at top (large amount, description, recurring badge), then Details card + Split Breakdown card, then destructive delete button at bottom.
- **Edit flow:** New route `mobile/app/(app)/groups/[id]/expense/[expenseId]/edit.tsx`. Add optional `initialData` props to `ExpenseForm` so it can be pre-populated. Edit screen wraps `ExpenseForm` with existing expense values. Header: "Edit expense" + Cancel. On submit → `updateExpense` → pop back.
- Remove swipe-to-delete (already done in a prior session).

---

## 5. Fix Bottom Action Bar + Inline Add Expense Button (TASK-11)

**Problem:** "Recurring" button in the action island; Add Expense is too large; no inline button pattern.

**Design:**
- Remove "Recurring" button entirely from the action island.
- Remove the float/bounce animation on the Add button (gimmicky).
- Add a full-width amber "Add expense" button **inline in the ScrollView**, placed between the balance card and the "Expenses" section header.
- Action island becomes **Settle Up only** — a single full-width pill button.
- **Circular FAB:** When the inline Add button scrolls off-screen upward, a small circular amber `+` FAB appears bottom-right (above the island). Implemented via `onLayout` (measure inline button Y) + `onScroll` (track offset). FAB fades/scales in with `Animated` or Reanimated.

---

## 6. Dashboard Hero Image

**Problem:** Dashboard uses a flat amber card; web app has a `birds.jpg` hero with gradient.

**Design:**
- Copy `public/birds.jpg` to `mobile/assets/birds.jpg`.
- Replace the amber `Card` hero with an `ImageBackground` using the local asset.
- Gradient overlay: `from-stone-900/80 via-stone-900/40 to-transparent` (top-to-bottom or bottom).
- "Hey {displayName}." in large bold white text, balance below in white/emerald/rose.
- Keep the "New group" button and section headers below unchanged.

---

## 7. Dashboard Add Expense FAB (TASK-15)

**Problem:** No way to add an expense from the dashboard.

**Design:**
- Circular amber FAB at bottom-right of dashboard (above safe area). Hidden when user has no groups.
- Tapping navigates to new screen: `mobile/app/(app)/(dashboard)/add-expense-picker.tsx`.
- **Picker screen:** Search bar at top (auto-focused). Flat list below showing groups (with `GroupThumbnail`) and friends (with `Avatar`) and their balances. User types to filter by name. Selecting a group navigates to `/(app)/groups/${groupId}/add-expense`. Selecting a friend navigates to `/(app)/(dashboard)/add-friend-expense?friendId=${userId}`.
- Update `add-friend-expense.tsx` to accept optional `friendId` route param; if present, pre-select that friend and skip straight to the form.
- Use `frontend-design` skill.

---

## 8. Activity Drawer Redesign

**Problem:** Close button cut off at bottom, text too small.

**Design:** Redesign by frontend-design agent.
- Sheet snap points adjusted to ensure the close button is always visible above safe area inset.
- All text sizes increased (title: 16px semibold, detail labels: 14px, timestamps: 13px).
- "Close" button styled as a solid full-width button at bottom, always visible, respects `insets.bottom`.
- Use `frontend-design` skill.

---

## 9. Group Settings Redesign + Fix Name Edit (TASK-6 adjacent)

**Problem:** Group name edit form is broken; settings page needs a full redesign to match web.

**Design:** Redesign by frontend-design agent.
- Fix the name edit: when `editingName` is true, the `Input` inside a `View` inside a flat container should work — investigate and fix. Most likely the `Input` component needs `autoFocus` properly plumbed or the container layout is wrong.
- Redesign settings layout to mirror web: clear section headers, row items with icon + label + chevron, banner preview with change affordance, danger zone at bottom.
- Use `frontend-design` skill.

---

## 10. Leave Group Enforcement

**Problem:** Mobile shows a toast instead of a proper modal with debt info like the web.

**Design:** Match web behavior exactly.
- When `outstandingCents > 0`: show a proper Alert or modal explaining the user has `$X` outstanding, with only a "Got it" button (no leave action available).
- When settled: show confirmation Alert with "Leave" (destructive) + "Cancel".
- The "Leave group" row in settings should show a warning badge/text below it when debt exists.

---

## 11. Account Settings: Add Back Button + Block Deletion with Debt

**Problem:** Settings page may lack a back button; account deletion doesn't check for outstanding debts.

**Design:**
- Add `ChevronLeft` back button to app settings header if missing.
- Before showing the delete account confirmation, check `useGroups()` data for any group where `Math.abs(balanceCents) > 0`. If any exist, show a blocking message listing the groups.
- Improve the delete account modal: use a proper styled modal (not just `Alert`) with clear warning, list of groups with outstanding balances, and a single "Got it" CTA when blocked. When unblocked, show a confirmation with display-name-typed confirmation or simple destructive button.
- Use `frontend-design` skill.

---

## Files Touched

| File | Change |
|------|--------|
| `mobile/app/(app)/groups/[id]/index.tsx` | SVG cover fix, inline Add button, FAB, remove Recurring, balance card redesign, expense item redesign |
| `mobile/app/(app)/groups/[id]/expense/[expenseId].tsx` | Detail page redesign |
| `mobile/app/(app)/groups/[id]/expense/[expenseId]/edit.tsx` | New file — edit screen |
| `mobile/app/(app)/groups/[id]/settings.tsx` | Name edit fix, leave group modal, settings redesign |
| `mobile/app/(app)/(dashboard)/index.tsx` | Birds.jpg hero, FAB |
| `mobile/app/(app)/(dashboard)/add-expense-picker.tsx` | New file — picker screen |
| `mobile/app/(app)/(dashboard)/add-friend-expense.tsx` | Accept `friendId` param |
| `mobile/app/(app)/settings/index.tsx` | Back button, account deletion debt check, modal redesign |
| `mobile/assets/birds.jpg` | New asset (copy from `public/birds.jpg`) |
| `mobile/components/ExpenseForm.tsx` | Add `initialData` props |

---

## Agent Instruction

**Every agent working on UI in this plan must use the `frontend-design` skill.** The goal is polished, native-quality interfaces that match or exceed the mobile web app. No generic-looking layouts — use depth, spacing, color, and typography thoughtfully.
