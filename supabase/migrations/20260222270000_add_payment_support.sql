-- Migration: Add payment support
-- Adds isPayment flag and createdById to Expense table.
-- Adds create_payment RPC for recording out-of-app payments.
-- Updates delete_expense RPC to enforce creator-only deletion for payments.

--------------------------------------------------------------------------------
-- 1. Schema changes
--------------------------------------------------------------------------------

ALTER TABLE "Expense" ADD COLUMN "isPayment" boolean NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "createdById" text REFERENCES "User"(id);

--------------------------------------------------------------------------------
-- 2. create_payment RPC
--    Records a payment (sent outside the app) as a special Expense:
--    - paidById = sender
--    - single ExpenseSplit for recipient with full amount
--    - Only the creator can later delete it
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_payment(
  _group_id text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _recipient_id text,
  _from_display_name text,
  _to_display_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _expense_id text;
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

  -- Verify recipient is a group member
  IF NOT EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id AND "userId" = _recipient_id
  ) THEN
    RAISE EXCEPTION 'Recipient is not a member of this group';
  END IF;

  -- Verify payer != recipient
  IF _paid_by_id = _recipient_id THEN
    RAISE EXCEPTION 'Payer and recipient must be different';
  END IF;

  -- Create payment expense
  INSERT INTO "Expense" ("groupId", "paidById", description, "amountCents", date, "isPayment", "createdById")
  VALUES (_group_id, _paid_by_id, 'Payment', _amount_cents, _date, true, _user_id)
  RETURNING id INTO _expense_id;

  -- Create single split for recipient (full amount)
  INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
  VALUES (_expense_id, _recipient_id, _amount_cents);

  -- Activity log
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'payment_recorded',
    jsonb_build_object(
      'amountCents', _amount_cents,
      'fromDisplayName', _from_display_name,
      'toDisplayName', _to_display_name
    )
  );

  RETURN _expense_id;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Replace delete_expense RPC
--    For payments: only the creator can delete; logs payment_deleted with
--    from/to names looked up from DB.
--    For expenses: existing behavior unchanged.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_expense(
  _expense_id text,
  _group_id text,
  _description text,
  _amount_cents int,
  _paid_by_display_name text
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
  _from_display_name text;
  _to_display_name text;
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

  -- Fetch payment metadata
  SELECT "isPayment", "createdById" INTO _is_payment, _created_by_id
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
        'fromDisplayName', _from_display_name,
        'toDisplayName', _to_display_name
      )
    );
  ELSE
    -- Regular expense deletion log
    INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
    VALUES (
      _group_id,
      _user_id,
      'expense_deleted',
      jsonb_build_object(
        'description', _description,
        'amountCents', _amount_cents,
        'paidByDisplayName', _paid_by_display_name
      )
    );
  END IF;

  -- Delete expense (cascade deletes splits)
  DELETE FROM "Expense" WHERE id = _expense_id AND "groupId" = _group_id;
END;
$$;
