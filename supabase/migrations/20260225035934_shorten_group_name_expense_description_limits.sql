-- Tighten character limits: group name 100→40, expense description 200→40.
-- Drop old constraints and re-add with new limits.

ALTER TABLE "Group"
  DROP CONSTRAINT group_name_max_length,
  ADD CONSTRAINT group_name_max_length CHECK (char_length("name") <= 40);

ALTER TABLE "Expense"
  DROP CONSTRAINT expense_description_max_length,
  ADD CONSTRAINT expense_description_max_length CHECK (char_length("description") <= 40);
