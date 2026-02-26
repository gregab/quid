---
name: plan-exit-review
version: 1.0.0
description: |
  Review a plan thoroughly before implementation. Challenges scope, reviews
  architecture/code quality/tests/performance, and walks through issues
  interactively with opinionated recommendations. Adapted for Aviary
  (Next.js + Supabase + React Native monorepo).
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
---

# Plan Review Mode

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

## Priority hierarchy

If you are running low on context or the user asks you to compress: Step 0 > Test diagram > Opinionated recommendations > Everything else. Never skip Step 0 or the test diagram.

## My engineering preferences (use these to guide your recommendations):

* DRY is important—flag repetition aggressively. Business logic belongs in `@aviary/shared`, never duplicated between web and mobile.
* Well-tested code is non-negotiable; I'd rather have too many tests than too few.
* I want code that's "engineered enough" — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
* I err on the side of handling more edge cases, not fewer; thoughtfulness > speed.
* Bias toward explicit over clever.
* Minimal diff: achieve the goal with the fewest new abstractions and files touched.
* Security is a top priority. Never take shortcuts that could expose user data.
* Money is always integers (cents). Never floats. No exceptions.

## BEFORE YOU START:

### Step 0: Scope Challenge

Before reviewing anything, answer these questions:

1. **What existing code already partially or fully solves each sub-problem?** Can we capture outputs from existing flows rather than building parallel ones? Check `@aviary/shared` first — the shared package likely already has utilities for common operations.

2. **What is the minimum set of changes that achieves the stated goal?** Flag any work that could be deferred without blocking the core objective. Be ruthless about scope creep.

3. **Complexity check:** If the plan touches more than 10 files or introduces more than 2 new modules/services, treat that as a smell and challenge whether the same goal can be achieved with fewer moving parts.

4. **Cross-platform impact:** Does this change touch `@aviary/shared`? If so, have both web and mobile consumers been considered?

Then ask if I want one of three options:

1. **SCOPE REDUCTION:** The plan is overbuilt. Propose a minimal version that achieves the core goal, then review that.

2. **BIG CHANGE:** Work through interactively, one section at a time (Architecture > Code Quality > Tests > Performance) with at most 4 top issues per section.

3. **SMALL CHANGE:** Compressed review — Step 0 + one combined pass covering all 4 sections. For each section, pick the single most important issue (think hard — this forces you to prioritize). Present as a single numbered list with lettered options + mandatory test diagram + completion summary. One AskUserQuestion round at the end.

**Critical: If I do not select SCOPE REDUCTION, respect that decision fully.** Your job becomes making the plan I chose succeed, not continuing to lobby for a smaller plan. Raise scope concerns once in Step 0 — after that, commit to my chosen scope and optimize within it. Do not silently reduce scope, skip planned components, or re-argue for less work during later review sections.

## Review Sections (after scope is agreed)

### 1. Architecture review

Evaluate:

* Overall system design and component boundaries.
* Dependency graph and coupling concerns.
* Data flow patterns and potential bottlenecks.
* **Supabase RLS:** Are new tables/views protected? Do RLS policies use `is_group_member()` correctly? Views must have `security_invoker = true`.
* **RPC functions:** Are mutations using SECURITY DEFINER RPCs with proper auth checks? Does the migration DROP before CREATE if the signature changed?
* **API route auth:** Does every new API route verify the Supabase session server-side?
* **Shared package boundaries:** Is new logic in the right place (`@aviary/shared` for pure logic, web `lib/` for re-exports, `app/api/` for server-only)?
* Security architecture (auth, data access, API boundaries, Zod validation at boundaries).
* For each new codepath or integration point, describe one realistic production failure scenario and whether the plan accounts for it.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

### 2. Code quality review

Evaluate:

* Code organization and module structure.
* DRY violations—be aggressive here. Check if logic is duplicated between web and mobile instead of living in `@aviary/shared`.
* Error handling patterns and missing edge cases (call these out explicitly).
* Technical debt hotspots.
* Areas that are over-engineered or under-engineered relative to my preferences.
* **Money handling:** Any new amount logic must use integer cents. Flag any floats.
* **Supabase gotchas:** Relation names match table names (`expense.User` not `expense.paidBy`). Dates are ISO strings. `params` is a Promise in Next.js 16.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

### 3. Test review

Make a diagram of all new UX, new data flow, new codepaths, and new branching if statements or outcomes. For each, note what is new about the features discussed in this plan. Then, for each new item in the diagram, make sure there is a test.

Test types to verify:
- New UI behavior → co-located `*.test.tsx` (happy-dom: use `fireEvent.submit`, wrap async in `act()`, `afterEach(cleanup)`)
- New pure function → co-located `*.test.ts`
- New user-facing flow → Cypress spec in `cypress/e2e/`
- New API route behavior → prefer Cypress
- New RPC function → verify via integration tests or Cypress
- Mobile changes → co-located tests in `mobile/` (separate test runner)

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

### 4. Performance review

Evaluate:

* N+1 queries and database access patterns.
* Memory-usage concerns.
* Supabase query efficiency (are we fetching too many relations? Can we use a view or RPC instead of multiple round-trips?).
* Caching opportunities.
* Slow or high-complexity code paths.
* **Migration safety:** Will the migration lock tables? Is it safe to run on production data?

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

## For each issue you find

For every specific issue (bug, smell, design concern, or risk):

* Describe the problem concretely, with file and line references.
* Present 2-3 options, including "do nothing" where that's reasonable.
* For each option, specify in one line: effort, risk, and maintenance burden.
* **Lead with your recommendation.** State it as a directive: "Do B. Here's why:" — not "Option B might be worth considering." Be opinionated. I'm paying for your judgment, not a menu.
* **Map the reasoning to my engineering preferences above.** One sentence connecting your recommendation to a specific preference (DRY, explicit > clever, minimal diff, etc.).
* **AskUserQuestion format:** Start with "We recommend [LETTER]: [one-line reason]" then list all options as `A) ... B) ... C) ...`. Label with issue NUMBER + option LETTER (e.g., "3A", "3B"). Never ask yes/no or open-ended questions.

## Required outputs

### "NOT in scope" section

Every plan review MUST produce a "NOT in scope" section listing work that was considered and explicitly deferred, with a one-line rationale for each item.

### "What already exists" section

List existing code/flows that already partially solve sub-problems in this plan, and whether the plan reuses them or unnecessarily rebuilds them. Pay special attention to `@aviary/shared` utilities, existing RPC functions, and existing Zod schemas.

### Deferred work

Any deferred work that is genuinely valuable — not just "nice to have" but would meaningfully improve the system — should be listed with:

* **What:** One-line description.
* **Why:** The concrete problem it solves.
* **Context:** Enough detail that someone picking this up later understands the motivation and where to start.

### Failure modes

For each new codepath identified in the test review diagram, list one realistic way it could fail in production (timeout, nil reference, race condition, stale data, RLS denial, etc.) and whether:

1. A test covers that failure
2. Error handling exists for it
3. The user would see a clear error or a silent failure

If any failure mode has no test AND no error handling AND would be silent, flag it as a **critical gap**.

### Completion summary

At the end of the review, fill in and display this summary:

```
- Step 0: Scope Challenge (user chose: __)
- Architecture Review: ___ issues found
- Code Quality Review: ___ issues found
- Test Review: diagram produced, ___ gaps identified
- Performance Review: ___ issues found
- NOT in scope: written
- What already exists: written
- Deferred work: ___ items listed
- Failure modes: ___ critical gaps flagged
```

## Formatting rules

* NUMBER issues (1, 2, 3...) and give LETTERS for options (A, B, C...).
* When using AskUserQuestion, label each option with issue NUMBER and option LETTER so I don't get confused.
* Recommended option is always listed first.
* Keep each option to one sentence max. I should be able to pick in under 5 seconds.
* After each review section, pause and ask for feedback before moving on.
* Use ASCII diagrams for any non-trivial data flow, state machine, or processing pipeline in the review itself.

## Unresolved decisions

If the user does not respond to an AskUserQuestion or interrupts to move on, note which decisions were left unresolved. At the end of the review, list these as "Unresolved decisions that may bite you later" — never silently default to an option.
