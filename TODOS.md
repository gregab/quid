# Quid — Todos

## Done
- Auth flow: login, signup, logout (Supabase email/password)
- Email confirmation callback (`auth/callback/route.ts`)
- Root page redirect based on auth state
- Auth middleware (`proxy.ts`) — protects app routes, redirects authed users from login/signup
- Dashboard: list groups, create group modal
- Group detail page: members list, expenses list, balance summary
- API: groups CRUD, add member, create expense (equal split), get balances
- Debt simplification algorithm (14 passing tests)
- Prisma schema + initial migration
- UI components: Button, Card, Input
- Env var validation in Supabase clients
- Production email confirmation links (fixed localhost bug)

## In Progress
<!-- Move items here when actively working on them -->

## Backlog
- Edit/delete expenses
- Loading and error states throughout UI
- Google OAuth
- Settings page (display name, avatar)
- Non-equal splits (custom split amounts)
- Extract Zod schemas to `lib/validators/`
- Shared TypeScript types (`types/`)
- API route integration tests
