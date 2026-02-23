-- Migration: Restrict expense edit/delete to the creator
--
-- Context: createdById column already exists (added in add_payment_support migration).
-- create_expense was not populating it. update_expense had no ownership check.
-- delete_expense already enforced creator-only for payments but not regular expenses.
--
-- Policy: Only the creator of an expense can edit or delete it.
-- Backward compat: expenses with NULL createdById (created before this migration)
-- are treated as legacy and allow any group member to edit/delete.

--------------------------------------------------------------------------------
-- 1. Update create_expense to populate createdById
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_expense(
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text
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

  -- Create expense (now populates createdById)
  INSERT INTO "Expense" ("groupId", "paidById", description, "amountCents", date, "createdById")
  VALUES (_group_id, _paid_by_id, _description, _amount_cents, _date, _user_id)
  RETURNING id INTO _expense_id;

  -- Compute and create splits
  _participant_count := array_length(_participant_ids, 1);
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
-- 2. Update update_expense to enforce creator-only editing
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
  _changes jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _created_by_id text;
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

  -- Fetch createdById for ownership check
  SELECT "createdById" INTO _created_by_id
  FROM "Expense"
  WHERE id = _expense_id AND "groupId" = _group_id;

  -- Only the creator can edit. NULL createdById = legacy expense, allow any group member.
  IF _created_by_id IS NOT NULL AND _created_by_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Only the creator can edit this expense';
  END IF;

  -- Update expense
  UPDATE "Expense"
  SET description = _description,
      "amountCents" = _amount_cents,
      date = _date,
      "paidById" = _paid_by_id
  WHERE id = _expense_id AND "groupId" = _group_id;

  -- Delete old splits and create new ones
  DELETE FROM "ExpenseSplit" WHERE "expenseId" = _expense_id;

  _participant_count := array_length(_participant_ids, 1);
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

--------------------------------------------------------------------------------
-- 3. Update delete_expense to enforce creator-only deletion for regular expenses
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
    -- Regular expense: only the creator can delete.
    -- NULL createdById = legacy expense, allow any group member.
    IF _created_by_id IS NOT NULL AND _created_by_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'Only the creator can delete this expense';
    END IF;

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
