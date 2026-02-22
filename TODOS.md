# Aviary — Todos

## Done
- Auth flow: login, signup, logout, email confirmation callback
- Auth middleware (`proxy.ts`) — protects app routes, redirects authed users from auth pages
- Dashboard: list groups, create group modal
- Group detail page: members, expenses, balances, activity feed
- API: groups CRUD, add member, create/edit/delete expense, get balances
- Debt simplification algorithm (14 unit tests)
- UI components: Button, Card, Input, Nav
- Expense edit/delete with atomic split recalculation (any group member can edit/delete)
- Payer selection and participant filtering on expenses
- Activity log: ActivityLog model + feed on group page with optimistic updates
- Dark mode: `dark:` variants throughout the app
- Optimistic updates on expense add, edit, delete + activity feed
- Smoke tests (unauthenticated + authenticated)
- Component tests: ExpensesList, ActivityFeed, useActivityLogs
- Cypress E2E tests — auth, dashboard, group detail, navigation specs
- **Migrate from Prisma to Supabase JS client** — RLS on all tables, RPC functions for atomic ops, removed Prisma/pg deps entirely
- **Leave group** — Members can leave groups (blocked if |balance| > $2); last member leaving deletes the group

## In Progress
<!-- Move items here when actively working on them -->

## Backlog

### P0: Core Gaps
- **Delete groups** — `DELETE /api/groups/[id]`, creator-only, cascade handles cleanup
- ~~**Remove members** — `DELETE /api/groups/[id]/members/[userId]`, block if unsettled debts~~ ✓ Done (self-removal via "Leave group")
- **Settle up** — Record payments as special expenses (description = "Settlement", single split to creditor)

### P1: UX Polish
- **Loading states** — `loading.tsx` skeletons for dashboard + group detail, `error.tsx` boundaries
- **Password reset** — "Forgot password?" page using Supabase `resetPasswordForEmail()`
- **Settings page** — Edit display name, avatar; `PATCH /api/user` route
- **Dashboard summaries** — Per-group net balance on group cards ("you owe $12.50")
- **Sort/filter expenses** — Client-side sort by date/amount, text search

### P2: Features
- **Non-equal splits** — Per-person amount entry, validate sums to total
- **Google OAuth** — Supabase native support, add "Sign in with Google" buttons
- **Expense categories/notes** — Optional category enum + notes field (schema migration)

### P3: Infrastructure
- **Extract Zod schemas** to `lib/validators/` for reuse (client + server)
- **Shared TypeScript types** in `types/` (API response shapes, domain types)
- **API route integration tests** — Test handlers directly with mocked Supabase
- ~~**Cypress E2E tests** — Full user flow coverage in real browser~~ ✓ Done
- **Mobile responsiveness audit** — Touch targets, modals, small screen layout
