-- Migration: Add settledUp flag to create_payment RPC
-- When a payment exactly zeroes out a debt between two people, the activity
-- log payload now includes settledUp: true so the feed can celebrate it.
-- Must DROP + CREATE because we're adding a parameter.

DROP FUNCTION IF EXISTS create_payment(text, int, date, text, text, text, text);

CREATE FUNCTION create_payment(
  _group_id text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _recipient_id text,
  _from_display_name text,
  _to_display_name text,
  _settled_up boolean DEFAULT false
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
      'toDisplayName', _to_display_name,
      'settledUp', _settled_up
    )
  );

  RETURN _expense_id;
END;
$$;
