# Quid — Expense Splitting App

## Project Overview
A Splitwise-style expense splitting app. Users create groups, add expenses, and the app calculates simplified debts between group members. Built as a learning/portfolio project that real people will use.

## Tech Stack
- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Deployment & URLs
- **Production domain:** `gregbigelow.com`
- **App lives at:** `https://gregbigelow.com/quid` — this is the Vercel project root, served under a `/quid` path prefix via `basePath: "/quid"` in `next.config.ts`
- All public URLs for this app start with `https://gregbigelow.com/quid`
- `NEXT_PUBLIC_SITE_URL` env var = `https://gregbigelow.com/quid` (set in Vercel). In dev, code falls back to `http://localhost:3000/quid`.
- Auth email confirmation callback: `https://gregbigelow.com/quid/auth/callback`
- Supabase dashboard must have Site URL = `https://gregbigelow.com/quid` and redirect allowlist including `https://gregbigelow.com/quid/auth/callback`

## Architecture Principles
- API routes should be resource-oriented (REST), not page-specific. A mobile client will eventually consume the same API.
- Use React Server Components for data fetching where possible. Client components only when interactivity requires it.
- Keep business logic (especially debt simplification) in pure functions with no framework dependencies, so they're testable and reusable.
- Supabase JS client handles auth only. All data access goes through Prisma.

## Project Structure
Note: The project does NOT use a `src/` directory. All code is at the repo root.
```
app/                        # Next.js App Router
  (auth)/                   # Auth pages — route group, no layout nesting
    login/page.tsx          # Email/password login (client component)
    signup/page.tsx         # Registration with display name (client component)
  auth/
    callback/route.ts       # Exchanges Supabase email confirmation code for session, redirects to /dashboard
  (app)/                    # Authenticated app pages — shared layout with nav
    layout.tsx              # Auth guard + Nav + container wrapper
    dashboard/
      page.tsx              # Lists user's groups (server component)
      CreateGroupButton.tsx # Modal form to create a group (client component)
    groups/[id]/
      page.tsx              # Group detail: members, expenses, balances (server component)
      AddMemberForm.tsx     # Modal form to add member by email (client component)
      AddExpenseForm.tsx    # Modal form to create expense (client component)
    settings/               # (not yet implemented)
  api/
    groups/route.ts         # POST create group, GET list groups
    groups/[id]/members/route.ts    # POST add member by email
    groups/[id]/expenses/route.ts   # POST create expense (equal split, prisma.$transaction)
    groups/[id]/balances/route.ts   # GET simplified debts with display names
  generated/prisma/         # Auto-generated Prisma client (do not edit)
  layout.tsx                # Root layout (fonts, globals, title: "Quid")
  page.tsx                  # Root redirect: authed → /dashboard, unauthed → /login
  globals.css               # Tailwind CSS imports
components/
  Nav.tsx                   # Top nav bar with logout (client component)
  ui/
    Button.tsx              # Styled button (variants: primary, secondary, ghost)
    Card.tsx                # White bordered card wrapper
    Input.tsx               # Styled text input
lib/
  supabase/
    client.ts               # Browser Supabase client
    server.ts               # Server Supabase client (cookie-aware)
  prisma/
    client.ts               # Prisma singleton with PrismaPg adapter
  balances/
    simplify.ts             # Debt simplification algorithm (pure function)
    simplify.test.ts        # 14 Vitest test cases
  validators/               # (not yet created) Zod schemas
types/                      # (not yet created) Shared TypeScript types
prisma/
  schema.prisma             # Database schema (User, Group, GroupMember, Expense, ExpenseSplit)
  migrations/               # Prisma migrations
prisma.config.ts            # Prisma config (loads .env.local)
```

## Key Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npx prisma migrate dev   # Run migrations (reads prisma.config.ts → .env.local)
npx prisma generate      # Regenerate Prisma client (output: app/generated/prisma/)
npx prisma studio        # Visual database browser
npm test                 # Run Vitest tests
```

## Code Style
- TypeScript strict mode. No `any` types.
- Functional components with hooks. No class components.
- Use Zod for all input validation (API routes and forms).
- Error handling: API routes return consistent `{ data, error }` shape.
- Use `async/await`, not `.then()` chains.
- Prefer named exports over default exports (except for page/layout files which Next.js requires as default).

## Database Notes
- Prisma 7 with `@prisma/adapter-pg` (driver adapter pattern). No direct Prisma connection string — uses `pg` Pool.
- `prisma.config.ts` loads `.env.local` via dotenv so Prisma CLI can read `DATABASE_URL`.
- `DATABASE_URL` should be the **direct** (non-pooled) connection string for migrations.
- The runtime Prisma client in `lib/prisma/client.ts` also reads `DATABASE_URL` to create a `pg.Pool`.
- All monetary values stored as integers (cents), never floats.
- Prisma client is generated to `app/generated/prisma/` (not node_modules).

## Models
- **User** — id (UUID), email (unique), displayName, avatarUrl?, createdAt
- **Group** — id, name, createdAt, createdById → User
- **GroupMember** — id, groupId → Group, userId → User, joinedAt. Unique on [groupId, userId]. Cascade delete.
- **Expense** — id, groupId → Group, paidById → User, description, amountCents (Int), date, createdAt
- **ExpenseSplit** — id, expenseId → Expense, userId → User, amountCents (Int). Cascade delete on expense.

## Testing
- Use Vitest for unit tests.
- Test the debt simplification algorithm thoroughly — it's the core logic.
- API route tests can use Prisma with a test database.

## Current State (as of 2026-02-21)
**Working:**
- Auth flow (login, signup, logout) via Supabase email/password
- Email confirmation callback (`app/auth/callback/route.ts`) — handles Supabase redirect, exchanges code for session
- Root page redirects based on auth state
- Dashboard: lists user's groups, create group modal
- API: `POST /api/groups` (create), `GET /api/groups` (list)
- Debt simplification algorithm with 13 passing tests
- Prisma schema with initial migration applied
- Group detail page (`/groups/[id]`): members, expenses list, balance summary
- Add member by email (`POST /api/groups/[id]/members`)
- Create expense with equal split (`POST /api/groups/[id]/expenses`)
- Balance calculation & display (wiring `simplify.ts` to real data, server-computed on page)
- GET `/api/groups/[id]/balances` (for mobile client use)
- UI components: Button, Card, Input in `components/ui/`

**Not yet built:**
- Edit/delete expenses
- Settings page
- Google OAuth
- Zod validator modules (`lib/validators/`)
- Shared types (`types/`)
- Loading/error states
- Non-equal splits (custom split amounts)

## Important Implementation Notes
- Next.js 16: `params` in page/route handler components is a `Promise<{ id: string }>` — must `await params`
- Prisma client: `import { prisma } from "@/lib/prisma/client"` (named export, not default)
- Expense splits: equal split distributes remainder 1 cent at a time to first N splits (`amountCents % memberCount` extra cents)
- Balances are computed server-side on the group page from already-fetched data (no extra DB call needed)
- `basePath: "/quid"` — Next.js internal routing is relative (e.g., `router.push("/dashboard")`), but external URLs like Supabase `emailRedirectTo` must include the full path: `${NEXT_PUBLIC_SITE_URL}/auth/callback` = `https://gregbigelow.com/quid/auth/callback`
- Auth email confirmation: `signUp` passes `emailRedirectTo` using `NEXT_PUBLIC_SITE_URL`. Signup page shows "check your email" state and does NOT redirect to dashboard (user isn't authenticated until they click the link).
