# Quid — Architecture & Planning

This document captures **why** things are the way they are. For **what** exists and how to use it, see CLAUDE.md.

## Architecture Decisions

### Why Prisma + Supabase (not just Supabase client)?
Supabase JS client couples you to Supabase's query API. Prisma gives us a standard ORM that works with any Postgres. If we ever migrate off Supabase hosting, only the connection string changes. Supabase is used strictly for auth (session management, email confirmation, OAuth).

### Why driver adapter pattern (Prisma 7 + pg Pool)?
Prisma 7 dropped built-in connection management in favor of `@prisma/adapter-pg`. We create our own `pg.Pool` and pass it to Prisma. This gives us control over pooling and works well with serverless (Vercel). The pool is created once via a module-level singleton.

### Why `proxy.ts` instead of `middleware.ts`?
Next.js 16 renamed the middleware file to `proxy.ts`. We tried renaming back to `middleware.ts` but it broke — `proxy.ts` is the correct convention. The proxy handles auth checks: protecting app routes and redirecting authenticated users away from login/signup.

### Why `basePath: "/quid"`?
The app is hosted at `gregbigelow.com/quid`, not at the domain root. Vercel's `basePath` config handles this. The key implication: Next.js internal routing (links, redirects) uses relative paths, but any URL sent to an external service (Supabase email redirects) must include the full `https://gregbigelow.com/quid/...` prefix via `NEXT_PUBLIC_SITE_URL`.

### Why cents (integers) for money?
Floating point arithmetic produces rounding errors (`0.1 + 0.2 !== 0.3`). Storing cents as integers avoids this entirely. All display formatting converts at the UI layer.

### Why equal-split remainder distribution?
When $10.00 is split 3 ways, you get $3.33 × 3 = $9.99 — one cent short. We distribute the remainder by giving 1 extra cent to the first N members (where N = amountCents % memberCount). This ensures splits always sum to exactly the expense total.

### Why generated Prisma client in `app/generated/prisma/`?
Default Prisma output goes to `node_modules/.prisma/client`, which gets blown away on `npm install`. Generating to `app/generated/prisma/` makes the output persistent and importable with `@/app/generated/prisma`. The build script runs `prisma generate` before `next build` to ensure it's always fresh.

### Why resource-oriented API routes?
A mobile client (React Native or similar) is a future goal. If API routes are page-specific (e.g., `/api/dashboard-data`), the mobile app can't reuse them cleanly. Resource-oriented routes (`/api/groups`, `/api/groups/[id]/expenses`) work for any client.

## Data Flow

```
Browser → proxy.ts (auth check) → Page/Route Handler
                                      ↓
                              Supabase server client (get session)
                                      ↓
                              Prisma (query/mutate data)
                                      ↓
                              PostgreSQL (Supabase-hosted)
```

- **Read paths**: Server Components fetch data directly via Prisma, render HTML.
- **Write paths**: Client components POST to API routes, which validate with Zod, mutate via Prisma, return JSON.
- **Balances**: Computed on-demand from expense/split data already fetched for the group page — no separate DB query or stored balance table.

## Open Design Questions

- **Non-equal splits UI**: Per-person amount entry vs. percentage-based? Percentage is more intuitive but introduces rounding complexity.
- **Settings scope**: Per-user global settings, per-group settings, or both? Start simple (per-user) and expand.
- **Mobile client**: Same Next.js API routes (add CORS) vs. separate API project? Leaning toward same routes — they're already resource-oriented.

## Future Roadmap

Roughly ordered by priority:
1. Edit/delete expenses
2. Loading states and error handling throughout UI
3. Google OAuth
4. Settings page (display name, avatar)
5. Non-equal splits (custom amounts per person)
6. Zod schemas extracted to `lib/validators/` (currently inline in route handlers)
7. Shared TypeScript types in `types/`
8. API route integration tests
9. Push notifications for new expenses
10. Recurring expenses
11. Multi-currency support
12. Export / settlement history
