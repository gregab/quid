-- Migration: Add splitType column + update RPCs to support custom splits

--------------------------------------------------------------------------------
-- 1. Add splitType column to Expense table
--------------------------------------------------------------------------------

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "splitType" text NOT NULL DEFAULT 'equal';

--------------------------------------------------------------------------------
-- 2. Update create_expense RPC to accept custom split amounts
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_expense(
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text,
  _split_type text DEFAULT 'equal',
  _split_amounts int[] DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _expense_id text;
  _participant_count int;
  _base_amount int;
  _remainder int;
  _i int;
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

  -- Create expense
  INSERT INTO "Expense" ("groupId", "paidById", description, "amountCents", date, "splitType")
  VALUES (_group_id, _paid_by_id, _description, _amount_cents, _date, _split_type)
  RETURNING id INTO _expense_id;

  -- Compute and create splits
  _participant_count := array_length(_participant_ids, 1);

  IF _split_amounts IS NOT NULL THEN
    -- Custom split: use provided amounts directly
    FOR _i IN 1.._participant_count LOOP
      INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
      VALUES (_expense_id, _participant_ids[_i], _split_amounts[_i]);
    END LOOP;
  ELSE
    -- Equal split
    _base_amount := _amount_cents / _participant_count;
    _remainder := _amount_cents % _participant_count;

    FOR _i IN 1.._participant_count LOOP
      INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
      VALUES (
        _expense_id,
        _participant_ids[_i],
        _base_amount + CASE WHEN _i <= _remainder THEN 1 ELSE 0 END
      );
    END LOOP;
  END IF;

  -- Activity log
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'expense_added',
    jsonb_build_object(
      'description', _description,
      'amountCents', _amount_cents,
      'paidByDisplayName', _paid_by_display_name
    )
  );

  RETURN _expense_id;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Update update_expense RPC to accept custom split amounts
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_expense(
  _expense_id text,
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text,
  _changes jsonb,
  _split_type text DEFAULT 'equal',
  _split_amounts int[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _participant_count int;
  _base_amount int;
  _remainder int;
  _i int;
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

  -- Update expense
  UPDATE "Expense"
  SET description = _description,
      "amountCents" = _amount_cents,
      date = _date,
      "paidById" = _paid_by_id,
      "splitType" = _split_type
  WHERE id = _expense_id AND "groupId" = _group_id;

  -- Delete old splits and create new ones
  DELETE FROM "ExpenseSplit" WHERE "expenseId" = _expense_id;

  _participant_count := array_length(_participant_ids, 1);

  IF _split_amounts IS NOT NULL THEN
    -- Custom split: use provided amounts directly
    FOR _i IN 1.._participant_count LOOP
      INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
      VALUES (_expense_id, _participant_ids[_i], _split_amounts[_i]);
    END LOOP;
  ELSE
    -- Equal split
    _base_amount := _amount_cents / _participant_count;
    _remainder := _amount_cents % _participant_count;

    FOR _i IN 1.._participant_count LOOP
      INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
      VALUES (
        _expense_id,
        _participant_ids[_i],
        _base_amount + CASE WHEN _i <= _remainder THEN 1 ELSE 0 END
      );
    END LOOP;
  END IF;

  -- Activity log
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'expense_edited',
    jsonb_build_object(
      'description', _description,
      'amountCents', _amount_cents,
      'paidByDisplayName', _paid_by_display_name,
      'changes', _changes
    )
  );
END;
$$;
