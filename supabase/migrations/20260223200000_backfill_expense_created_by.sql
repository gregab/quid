-- Migration: Backfill createdById for existing expenses using ActivityLog
--
-- The create_expense RPC was not populating createdById until migration
-- 20260223000000. However, every expense creation was logged to ActivityLog
-- with action='expense_added' and actorId set to the creator. Both the Expense
-- and ActivityLog rows are inserted in the same transaction, so their createdAt
-- timestamps are identical.
--
-- Match on groupId + createdAt + description + amountCents (from payload) to
-- safely identify the activity log entry for each expense and copy its actorId.

UPDATE "Expense" e
SET "createdById" = al."actorId"
FROM "ActivityLog" al
WHERE e."createdById" IS NULL
  AND e."isPayment" = false
  AND al.action = 'expense_added'
  AND al."groupId" = e."groupId"
  AND al."createdAt" = e."createdAt"
  AND al.payload->>'description' = e.description
  AND (al.payload->>'amountCents')::int = e."amountCents";
