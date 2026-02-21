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
The app is hosted at `gregbigelow.com/quid`, not at the domain root. Vercel's `basePath` config handles this automatically for internal Next.js routing.

**Two different URL rules — don't mix them up:**

| Use case | Correct approach | Why |
|---|---|---|
| External services (Supabase email redirects, OAuth) | Full absolute URL via `NEXT_PUBLIC_SITE_URL` | External services need a fully-qualified URL to redirect back to |
| Client-side `fetch()` to API routes | Root-relative path: `/quid/api/...` | Same-origin — no CORS preflight, works regardless of `www` vs. non-www |

**Never use `NEXT_PUBLIC_SITE_URL` directly in a client-side `fetch()` call.** Doing so hardcodes `gregbigelow.com` as the target. If Vercel serves the app at `www.gregbigelow.com` as well, the fetch becomes cross-origin, triggering a CORS preflight that fails when Vercel redirects between the two domains. This exact bug has occurred twice.

To get the basePath as a root-relative path in a client component:
```ts
const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
// → "/quid"
fetch(`${basePath}/api/groups`, ...);
```

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

## Design Decisions (Pending / In Discussion)

### Settle up: special expense vs. separate model?
**Decision: Start with special expense.** A settlement is recorded as a regular expense where the debtor "pays" the creditor. The expense description is "Settlement" and it has a single split assigned to the creditor for the full amount. This zeroes out the debt using the existing expense/split infrastructure — no schema migration, no new model. If we later need richer settlement tracking (partial settlements, payment method, confirmation from creditor), we can introduce a `Settlement` model then.

### Edit/delete permissions: payer-only vs. any member?
**Decision: Payer + group creator.** Only the user who paid the expense (or the group creator) can edit or delete it. This prevents disputes while giving the group admin an override. The group detail page should show edit/delete buttons only to authorized users.

### Member removal: what about unsettled debts?
**Decision: Block removal if debts exist.** Before removing a member, compute their net balance. If non-zero, return an error: "This member has unsettled debts. Settle up before removing." Exception: the member can always leave voluntarily and accept that debts are forgiven. Self-removal should warn but allow.

### Non-equal splits UI
Per-person amount entry (not percentage-based). Percentages add rounding complexity and users think in dollar amounts anyway. The form shows each member with an amount input, and validates that amounts sum to the expense total. Start with "Equal" as the default, "Custom" as an opt-in toggle.

### Group deletion: hard vs. soft delete?
**Decision: Hard delete for now.** The schema already has cascade deletes configured. No audit trail requirement exists yet. If we add activity logging later, revisit with soft delete (add `deletedAt` column).

### Settings scope
Per-user global settings only (display name, avatar). No per-group settings yet — not enough features to warrant group-level config.

### Mobile client
Same Next.js API routes rather than a separate API project. The routes are already resource-oriented and return consistent `{ data, error }` JSON. When the time comes, add CORS headers to allow the mobile app's origin. Note: the web app deliberately avoids CORS entirely by using same-origin (root-relative) fetch URLs — CORS headers are only needed for cross-origin clients like a native app.

## Open Design Questions

- **Dashboard balance computation cost**: Computing per-group net balance for every group on the dashboard requires joining expenses+splits for each group. Fine for <50 groups per user, but may need materialized balances later. Monitor query times.
- **Expense categories**: Free-text tags vs. predefined enum? Free-text is more flexible; enum gives better filtering/reporting. Leaning toward a small predefined set with "Other" escape hatch.
- **Notification system**: Email vs. in-app vs. push? Start with in-app only (toast-style). Email notifications are a separate effort requiring a transactional email setup.

## Roadmap

See TODOS.md for the detailed, prioritized backlog with implementation notes. Summary:

- **P0 (Core gaps)**: Edit/delete expenses, delete groups, remove members, settle up
- **P1 (UX polish)**: Loading states, password reset, settings page, dashboard summaries, sort/filter
- **P2 (Features)**: Non-equal splits, Google OAuth, categories/notes, activity log
- **P3 (Infra)**: Extract validators, shared types, integration tests, dark mode, mobile audit
