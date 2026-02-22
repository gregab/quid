# Quid — Architecture & Planning

Why things are the way they are. For what exists and how to use it, see CLAUDE.md.

## Architecture Decisions

### Prisma + Supabase (not just Supabase client)
Supabase JS client couples you to Supabase's query API. Prisma gives a standard ORM that works with any Postgres — if we migrate off Supabase hosting, only the connection string changes. Supabase is used strictly for auth.

### Driver adapter pattern (Prisma 7 + pg Pool)
Prisma 7 dropped built-in connection management in favor of `@prisma/adapter-pg`. We create a `pg.Pool` and pass it to Prisma, giving us control over pooling. The pool is a module-level singleton in `lib/prisma/client.ts`.

### `proxy.ts` instead of `middleware.ts`
Next.js 16 renamed middleware to `proxy.ts`. We confirmed `middleware.ts` doesn't work — `proxy.ts` is required. It handles auth checks: protecting app routes and redirecting authenticated users away from login/signup.

### `basePath: "/quid"`
The app lives at `gregbigelow.com/quid`, not the domain root. Vercel's `basePath` handles internal routing automatically.

**Two URL rules — don't mix them up:**
| Context | Correct approach | Why |
|---|---|---|
| External services (email redirects, OAuth) | Full URL via `NEXT_PUBLIC_SITE_URL` | External services need a fully-qualified redirect target |
| Client-side `fetch()` | Root-relative: `/quid/api/...` | Same-origin, no CORS issues regardless of `www` vs non-`www` |

**Never use `NEXT_PUBLIC_SITE_URL` in client-side `fetch()`.** This has caused CORS bugs twice. Extract the basePath instead:
```ts
const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
```

### Cents (integers) for money
`0.1 + 0.2 !== 0.3`. Storing cents as integers avoids floating point errors. Display formatting converts at the UI layer.

### Equal-split remainder distribution
$10.00 ÷ 3 = $3.33 × 3 = $9.99 (1 cent short). We give 1 extra cent to the first N members where N = amountCents % memberCount, ensuring splits always sum to the expense total exactly.

### Generated Prisma client in `app/generated/prisma/`
Default output goes to `node_modules/.prisma/client` which gets wiped on `npm install`. Generating to `app/generated/prisma/` makes it persistent and importable via `@/app/generated/prisma`.

### Resource-oriented API routes
A future mobile client should reuse the same API. Resource-oriented routes (`/api/groups`, `/api/groups/[id]/expenses`) work for any client, unlike page-specific endpoints.

### Optimistic updates with server reconciliation
Client components apply mutations immediately (with `isPending` flag), then reconcile via `router.refresh()`. This gives instant UI feedback while keeping the server as source of truth. Failures revert automatically.

### Activity logging
All expense mutations (add, edit, delete) create an `ActivityLog` entry in the same transaction. The activity feed renders these with relative timestamps. Optimistic updates handle activity logs the same way as expenses.

## Decided Design Questions

These were previously open — documenting the decisions for context.

### Settle up approach
**Decision: Special expense.** A settlement is a regular expense where the debtor "pays" the creditor. Description = "Settlement", single split to the creditor. Uses existing expense infrastructure, no schema migration. If richer tracking is needed later (partial settlements, payment confirmation), introduce a `Settlement` model then.

### Edit/delete permissions
**Decision: Any group member.** Any member of the group can edit or delete any expense. This was chosen for simplicity over the initial "payer + group creator" plan. Revisit if users report problems.

### Member removal with unsettled debts
**Decision: Block if debts exist.** Compute net balance before removal — if non-zero, return an error. Exception: self-removal ("leave group") should warn but allow if debts are settled.

### Non-equal splits UI
**Decision: Per-person amounts, not percentages.** Users think in dollar amounts. The form will show each member with an amount input, validating that splits sum to the total. "Equal" as default, "Custom" as opt-in toggle. Not yet implemented.

### Group deletion
**Decision: Hard delete.** Cascade deletes handle cleanup. No audit trail requirement yet. Revisit with soft delete if activity logging needs historical groups.

## Open Design Questions

- **Dashboard balance computation cost**: Computing per-group net balance for every group requires joining expenses+splits per group. Fine for <50 groups/user, may need materialized balances later.
- **Expense categories**: Free-text tags vs predefined enum? Leaning toward small predefined set with "Other" escape hatch.
- **Notification system**: Start with in-app only (toast-style). Email notifications are a separate effort.
- **Mobile client**: Same API routes with CORS headers added for cross-origin native apps. The web app deliberately avoids CORS by using same-origin fetch.
