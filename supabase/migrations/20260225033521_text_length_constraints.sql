-- Enforce max character lengths at the DB level (defense-in-depth).
-- These mirror the constants in lib/constants.ts and Zod schemas in API routes.

ALTER TABLE "Group"
  ADD CONSTRAINT group_name_max_length CHECK (char_length("name") <= 100);

ALTER TABLE "Expense"
  ADD CONSTRAINT expense_description_max_length CHECK (char_length("description") <= 200);

ALTER TABLE "User"
  ADD CONSTRAINT user_display_name_max_length CHECK (char_length("displayName") <= 30);
