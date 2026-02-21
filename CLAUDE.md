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

## Architecture Principles
- API routes should be resource-oriented (REST), not page-specific. A mobile client will eventually consume the same API.
- Use React Server Components for data fetching where possible. Client components only when interactivity requires it.
- Keep business logic (especially debt simplification) in pure functions with no framework dependencies, so they're testable and reusable.
- Supabase JS client handles auth only. All data access goes through Prisma.

## Project Structure
```
src/
  app/                    # Next.js App Router
    (auth)/               # Auth pages (login, signup) — route group, no layout nesting
    (app)/                # Authenticated app pages — shared layout with nav
      dashboard/
      groups/[id]/
      settings/
    api/                  # API routes
      groups/
      expenses/
      balances/
  components/             # Shared React components
    ui/                   # Generic UI primitives (Button, Card, Input, etc.)
  lib/
    supabase/             # Supabase client setup (browser + server)
    prisma/               # Prisma client + schema
    balances/             # Debt simplification algorithm
    validators/           # Zod schemas for input validation
  types/                  # Shared TypeScript types
```

## Key Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npx prisma migrate dev   # Run migrations
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Visual database browser
npm test                 # Run tests
```

## Code Style
- TypeScript strict mode. No `any` types.
- Functional components with hooks. No class components.
- Use Zod for all input validation (API routes and forms).
- Error handling: API routes return consistent `{ data, error }` shape.
- Use `async/await`, not `.then()` chains.
- Prefer named exports over default exports (except for page/layout files which Next.js requires as default).

## Database Notes
- Prisma connects to Supabase Postgres via direct connection string (not the pooled/Supavisor one) for migrations.
- Use the pooled connection string for the app at runtime.
- All monetary values stored as integers (cents), never floats.

## Testing
- Use Vitest for unit tests.
- Test the debt simplification algorithm thoroughly — it's the core logic.
- API route tests can use Prisma with a test database.
