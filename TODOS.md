# Quid — Todos

## Done
- Auth flow: login, signup, logout (Supabase email/password)
- Email confirmation callback (`auth/callback/route.ts`)
- Root page redirect based on auth state
- Auth middleware (`proxy.ts`) — protects app routes, redirects authed users from login/signup
- Dashboard: list groups, create group modal
- Group detail page: members list, expenses list, balance summary
- API: groups CRUD, add member, create expense (equal split), get balances
- Fix add-member bug: upsert User row in auth callback so target users exist in Prisma before first app visit
- Debt simplification algorithm (14 passing tests)
- Prisma schema + initial migration
- UI components: Button, Card, Input
- Env var validation in Supabase clients
- Production email confirmation links (fixed localhost bug)
- Smoke tests (unauthenticated + authenticated) for auth, API, basePath
- Edit expenses: PUT /api/groups/[id]/expenses/[expenseId] with atomic split recalculation (payer only)
- Delete expenses: DELETE /api/groups/[id]/expenses/[expenseId] (payer or group creator); ExpenseActions component with edit modal + delete confirmation

## In Progress
<!-- Move items here when actively working on them -->

## Backlog — Prioritized

### P0: Core Functionality Gaps (users can't work around these)

These are features that real users will hit immediately and have no workaround for. The app isn't truly usable without them.

#### ~~1. Edit expenses~~ ✓ Done
- **Why**: Users make typos, enter wrong amounts, or pick the wrong date. Currently there's no way to fix a mistake — the only option is to create a compensating expense, which clutters the history.
- **Scope**: Add `PUT /api/groups/[id]/expenses/[expenseId]` route. Only the expense creator (or group creator?) should be able to edit. Must recalculate splits atomically in a transaction. Add an edit button/modal on each expense card in the group detail page.
- **Files to touch**: New route file `app/api/groups/[id]/expenses/[expenseId]/route.ts`, update `app/(app)/groups/[id]/page.tsx` to add edit UI, new client component for the edit form.
- **Validation**: Same Zod schema as create. Verify user is member and is the original payer.

#### ~~2. Delete expenses~~ ✓ Done
- **Why**: Same as edit — mistakes happen, and sometimes an expense was entered in the wrong group entirely.
- **Scope**: Add `DELETE /api/groups/[id]/expenses/[expenseId]` route. Cascade delete handles splits automatically (schema already has `onDelete: Cascade` on ExpenseSplit). Add a delete button with confirmation dialog on each expense card.
- **Files to touch**: Same route file as edit (`app/api/groups/[id]/expenses/[expenseId]/route.ts`), update group detail page with delete button + confirmation.
- **Auth**: Only the payer or group creator should be able to delete.

#### 3. Delete groups
- **Why**: Users create test groups or groups that are no longer needed. Currently they persist forever on the dashboard.
- **Scope**: Add `DELETE /api/groups/[id]` route. Only the group creator can delete. Cascade delete handles members, expenses, and splits (schema already configured). Add delete option on group detail page (not dashboard — require the user to see what they're deleting).
- **Files to touch**: New handler in `app/api/groups/[id]/route.ts` (new file — currently no single-group route exists), update group detail page header with delete button + confirmation.
- **Consider**: Should we soft-delete (add `deletedAt` column) or hard-delete? Hard delete is simpler and fine for now since there's no audit trail requirement yet.

#### 4. Remove members from groups
- **Why**: People get added by mistake, or leave a shared living situation. Currently members are permanent.
- **Scope**: Add `DELETE /api/groups/[id]/members/[userId]` route. Only the group creator or the member themselves should be able to remove. Block removal if the member has unsettled debts (non-zero balance). Self-removal ("leave group") should always be allowed if debts are settled.
- **Files to touch**: New handler in `app/api/groups/[id]/members/route.ts` (add DELETE) or new route file, update members section in group detail page with remove buttons.
- **Edge case**: If the group creator removes themselves, either transfer ownership or prevent it.

#### 5. Settle up / record payments
- **Why**: The whole point of the app is to track who owes whom. Without a way to record "I paid you back," debts accumulate forever and become meaningless noise.
- **Scope**: This is the most impactful missing feature. Two approaches:
  - **Simple (recommended first)**: Add a "Settle up" button that creates a special expense where the debtor pays the creditor the exact owed amount. The expense description could be "Settlement" and it would have only one split (the creditor). This zeroes out the debt using the existing expense/split system.
  - **Full**: Add a separate `Settlement` model. More correct but more complex — save for later.
- **Files to touch**: Could be implemented as a special case in `AddExpenseForm` or a new `SettleUpButton` component on the group detail page. The API route is the same `POST /api/groups/[id]/expenses` with a flag or convention.
- **Display**: Settlement expenses should render differently in the expense list (e.g., "Greg paid Sarah $15.00 (settlement)" instead of the standard expense card).

### P1: UX Polish (users will be frustrated without these)

#### 6. Loading states and error boundaries
- **Why**: Currently, pages have no loading feedback. When server components are fetching data, the user sees a white screen or stale content. Form submissions show "Creating..." but there are no skeleton loaders.
- **Scope**:
  - Add `loading.tsx` files for dashboard and group detail pages (Next.js convention for Suspense boundaries). These should show skeleton cards matching the layout.
  - Add error boundaries (`error.tsx`) that show a retry button instead of crashing.
  - Add toast/notification component for success feedback after creating groups, adding members, adding expenses.
- **Files to touch**: New `app/(app)/dashboard/loading.tsx`, `app/(app)/groups/[id]/loading.tsx`, `app/(app)/dashboard/error.tsx`, `app/(app)/groups/[id]/error.tsx`. New `components/ui/Toast.tsx` or similar.

#### 7. Password reset flow
- **Why**: Users forget passwords. Without reset, they're locked out permanently.
- **Scope**: Supabase supports `resetPasswordForEmail()` which sends a reset link. Need a "Forgot password?" link on the login page, a `/forgot-password` page with an email form, and the callback handling in `auth/callback/route.ts` (Supabase uses the same callback route with a different `type` parameter).
- **Files to touch**: New page `app/(auth)/forgot-password/page.tsx`, update login page to link to it, may need to update `auth/callback/route.ts` to handle password reset tokens.

#### 8. Settings page (edit display name)
- **Why**: Users set their display name at signup and can never change it. If they made a typo or want to update their name, they're stuck.
- **Scope**: New `/settings` page accessible from the nav. Form to update `displayName` (and eventually `avatarUrl`). Add `PUT /api/user` or `PATCH /api/user` route that updates the Prisma User record.
- **Files to touch**: New page `app/(app)/settings/page.tsx`, new API route `app/api/user/route.ts`, update `components/Nav.tsx` to add settings link.

#### 9. Dashboard group cards — show summary info
- **Why**: Currently, group cards on the dashboard only show the group name. Users have to click into each group to see if they owe anything. A glance at the dashboard should tell you your financial status.
- **Scope**: On the dashboard, each group card should show: member count, your net balance (e.g., "you owe $12.50" or "you're owed $8.00" or "settled up"). This requires a lightweight balance calculation per group on the dashboard query.
- **Files to touch**: Update `app/(app)/dashboard/page.tsx` to include expense/split data in the Prisma query and compute per-group net balance for the current user.
- **Performance consideration**: This adds more data to the dashboard query. For now it's fine — users won't have hundreds of groups. If it becomes slow, add a materialized balance column later.

#### 10. Sort and filter expenses
- **Why**: Groups with many expenses become hard to navigate. Users want to find a specific expense or see the most recent ones.
- **Scope**: Add sort controls (by date, by amount) and a simple text search/filter on the group detail page. This can be client-side since all expenses are already loaded.
- **Files to touch**: Update `app/(app)/groups/[id]/page.tsx` to pass expenses to a new client component that handles sort/filter state.

### P2: Feature Expansion (competitive parity with Splitwise)

#### 11. Non-equal splits (custom amounts per person)
- **Why**: Not all expenses should be split equally. Rent might be split 60/40, a dinner might exclude someone who didn't eat.
- **Scope**: Update the add expense form to allow choosing split type: "Equal" (current behavior) or "Custom" (enter amount per person). The API already accepts arbitrary split amounts — the equal distribution is just the default. The form needs a multi-person amount input that validates splits sum to the total.
- **Open question**: Should we support percentage-based splits? Start with exact amounts — percentages add rounding complexity.
- **Files to touch**: Update `AddExpenseForm`, update `POST /api/groups/[id]/expenses` to accept an optional `splits` array.

#### 12. Google OAuth
- **Why**: Reduces signup friction. Many users prefer not to create yet another email/password combo.
- **Scope**: Supabase supports Google OAuth natively. Need to configure Google Cloud OAuth credentials in Supabase dashboard, add a "Sign in with Google" button to login/signup pages, and ensure the auth callback handles OAuth flows correctly.
- **Files to touch**: Update login and signup pages, possibly update `auth/callback/route.ts`, Supabase dashboard configuration.
- **Prerequisite**: Google Cloud project with OAuth consent screen configured.

#### 13. Expense categories and notes
- **Why**: Users want to categorize expenses (Food, Rent, Utilities, etc.) and add notes or context.
- **Scope**: Add optional `category` field to Expense model (enum or free-text). Add optional `notes` field (longer text). Update the add/edit expense forms. Display category as a badge on expense cards.
- **Schema change**: Requires a Prisma migration to add columns.

#### 14. Activity/history log
- **Why**: Users want to know who added what and when. "Who added that $200 expense?" Currently there's no audit trail.
- **Scope**: Could be a simple chronological feed on the group page: "Greg added 'Groceries' ($45.00) on Jan 15" / "Sarah was added to the group on Jan 10". No separate model needed initially — derive from existing `createdAt` timestamps on expenses and members.
- **Files to touch**: New section on group detail page, or a separate `/groups/[id]/activity` page.

### P3: Infrastructure & Code Quality

#### 15. Extract Zod schemas to `lib/validators/`
- **Why**: Schemas are currently inline in each route handler. Extracting them enables reuse (e.g., client-side validation using the same schema) and makes routes cleaner.
- **Scope**: Create `lib/validators/group.ts`, `lib/validators/expense.ts`, `lib/validators/member.ts`. Import from route handlers.

#### 16. Shared TypeScript types in `types/`
- **Why**: API response types, form data types, and component prop types are currently ad-hoc. Shared types improve type safety across client/server boundary.
- **Scope**: Create `types/api.ts` (response shapes), `types/models.ts` (domain types beyond Prisma generated types), etc.

#### 17. API route integration tests
- **Why**: Smoke tests verify the deployed app works end-to-end, but don't test individual routes in isolation. Integration tests would catch route-level bugs without needing a running server.
- **Scope**: Test each API route handler directly using Next.js test utilities. Mock Prisma and Supabase clients. Verify auth checks, validation, and response shapes.

#### 18. Dark mode
- **Why**: User preference. Many users prefer dark mode, especially on mobile.
- **Scope**: Tailwind supports dark mode via `dark:` prefix. Need a theme toggle in settings/nav, CSS variable approach for consistent theming, and `dark:` variants on all components.

#### 19. Mobile responsiveness audit
- **Why**: The app likely works on mobile (Tailwind is responsive by default) but hasn't been explicitly designed for small screens. Modals, forms, and navigation may need adjustments.
- **Scope**: Test on various screen sizes, fix any layout issues, ensure touch targets are adequate.
