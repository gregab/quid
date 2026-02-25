-- Masking views for manual debugging — hides sensitive user content
-- The app never queries these; they exist solely for safe ad-hoc SQL inspection.

CREATE VIEW "ExpenseMasked" AS
SELECT
  id,
  "groupId",
  "paidById",
  "amountCents",
  '***' AS description,
  date,
  "createdAt",
  "createdById",
  "isPayment",
  "splitType",
  "recurringExpenseId",
  "settledUp",
  "updatedAt"
FROM "Expense";

CREATE VIEW "RecurringExpenseMasked" AS
SELECT
  id,
  "groupId",
  "paidById",
  "amountCents",
  '***' AS description,
  "participantIds",
  "splitType",
  "customSplits",
  frequency,
  "nextDueDate",
  "isActive",
  "createdById",
  "createdAt"
FROM "RecurringExpense";

CREATE VIEW "ActivityLogMasked" AS
SELECT
  id,
  "groupId",
  "actorId",
  action,
  '***' AS payload,
  "createdAt"
FROM "ActivityLog";
