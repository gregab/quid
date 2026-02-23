--------------------------------------------------------------------------------
-- Add updatedAt column to Expense
-- Automatically set on every UPDATE via a BEFORE trigger.
-- Existing rows stay NULL (= never edited); the UI uses NULL to skip display.
--------------------------------------------------------------------------------

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz;

--------------------------------------------------------------------------------
-- Trigger function — sets updatedAt to now() before any UPDATE
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_expense_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER expense_updated_at_trigger
  BEFORE UPDATE ON "Expense"
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_updated_at();
