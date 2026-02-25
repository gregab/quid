-- Tighten character limits: group name 100→40, expense description 200→65.
-- Truncate any existing rows that exceed the new limits, then update constraints.

UPDATE "Group" SET "name" = left("name", 40) WHERE char_length("name") > 40;
UPDATE "Expense" SET "description" = left("description", 65) WHERE char_length("description") > 65;

ALTER TABLE "Group"
  DROP CONSTRAINT group_name_max_length,
  ADD CONSTRAINT group_name_max_length CHECK (char_length("name") <= 40);

ALTER TABLE "Expense"
  DROP CONSTRAINT expense_description_max_length,
  ADD CONSTRAINT expense_description_max_length CHECK (char_length("description") <= 65);
