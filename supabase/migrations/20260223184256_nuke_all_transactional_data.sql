-- Wipe all transactional data (expenses, splits, activity logs) from all groups.
-- Keeps groups, members, and users intact.
-- Order matters due to foreign key constraints.

DELETE FROM "ExpenseSplit";
DELETE FROM "Expense";
DELETE FROM "ActivityLog";
