-- Migration: Clean up recurring template when deleting a recurring expense
--
-- Problem: When a user deletes an expense that belongs to a recurring series,
-- the RecurringExpense template stays active and the daily cron continues
-- generating new instances. The user expects deletion to stop future instances.
--
-- Fix: After deleting the expense, if it had a recurringExpenseId, also delete
-- the RecurringExpense template. The FK ON DELETE SET NULL automatically
-- nullifies recurringExpenseId on all other instances in the series.

-- Drop existing overload (7 params from cleanup migration)
DROP FUNCTION IF EXISTS delete_expense(text, text, text, int, text, date, text[]);

CREATE OR REPLACE FUNCTION delete_expense(
  _expense_id text,
  _group_id text,
  _description text,
  _amount_cents int,
  _paid_by_display_name text,
  _date date DEFAULT NULL,
  _participant_display_names text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _is_payment boolean;
  _created_by_id text;
  _split_type_val text;
  _recurring_expense_id text;
  _from_display_name text;
  _to_display_name text;
  _splits_jsonb jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is a group member
  IF NOT EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id AND "userId" = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Fetch expense metadata (now includes recurringExpenseId)
  SELECT "isPayment", "createdById", "splitType", "recurringExpenseId"
  INTO _is_payment, _created_by_id, _split_type_val, _recurring_expense_id
  FROM "Expense"
  WHERE id = _expense_id AND "groupId" = _group_id;

  IF _is_payment THEN
    -- Only the creator can delete a payment
    IF _created_by_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'Only the creator can delete a payment';
    END IF;

    -- Look up from/to display names for the activity log
    SELECT u."displayName" INTO _from_display_name
    FROM "Expense" e
    JOIN "User" u ON u.id = e."paidById"
    WHERE e.id = _expense_id;

    SELECT u."displayName" INTO _to_display_name
    FROM "ExpenseSplit" s
    JOIN "User" u ON u.id = s."userId"
    WHERE s."expenseId" = _expense_id
    LIMIT 1;

    -- Activity log for payment deletion
    INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
    VALUES (
      _group_id,
      _user_id,
      'payment_deleted',
      jsonb_build_object(
        'amountCents', _amount_cents,
        'date', _date::text,
        'fromDisplayName', _from_display_name,
        'toDisplayName', _to_display_name
      )
    );
  ELSE
    -- Regular expense: only the creator can delete.
    -- NULL createdById = unknown creator — block delete (all were backfilled).
    IF _created_by_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'Only the creator can delete this expense';
    END IF;

    -- Build splits snapshot from the DB before deleting
    SELECT jsonb_agg(
      jsonb_build_object('displayName', u."displayName", 'amountCents', s."amountCents")
      ORDER BY s."userId"
    )
    INTO _splits_jsonb
    FROM "ExpenseSplit" s
    JOIN "User" u ON u.id = s."userId"
    WHERE s."expenseId" = _expense_id;

    -- Regular expense deletion log
    INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
    VALUES (
      _group_id,
      _user_id,
      'expense_deleted',
      jsonb_build_object(
        'description', _description,
        'amountCents', _amount_cents,
        'date', _date::text,
        'paidByDisplayName', _paid_by_display_name,
        'splitType', _split_type_val,
        'splits', _splits_jsonb,
        'participantDisplayNames', to_jsonb(_participant_display_names)
      )
    );
  END IF;

  -- Delete expense (cascade deletes splits)
  DELETE FROM "Expense" WHERE id = _expense_id AND "groupId" = _group_id;

  -- Clean up recurring template if this expense was part of a recurring series.
  -- This stops the cron from generating future instances.
  -- FK ON DELETE SET NULL automatically clears recurringExpenseId on other instances.
  IF _recurring_expense_id IS NOT NULL THEN
    DELETE FROM "RecurringExpense" WHERE id = _recurring_expense_id;
  END IF;
END;
$$;
