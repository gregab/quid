-- Migration: Enrich activity log payloads with date and participant names
--
-- Adds 'date' to all activity log payloads and 'participantDisplayNames' to
-- expense_added / expense_deleted payloads so the activity feed modal can
-- display meaningful before/after context without extra DB queries.

--------------------------------------------------------------------------------
-- 1. create_expense: add date + participantDisplayNames to payload
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
  _split_amounts int[] DEFAULT NULL,
  _participant_display_names text[] DEFAULT NULL
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
  INSERT INTO "Expense" ("groupId", "paidById", description, "amountCents", date, "splitType", "createdById")
  VALUES (_group_id, _paid_by_id, _description, _amount_cents, _date, _split_type, _user_id)
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
      'date', _date::text,
      'paidByDisplayName', _paid_by_display_name,
      'participantDisplayNames', to_jsonb(_participant_display_names)
    )
  );

  RETURN _expense_id;
END;
$$;

--------------------------------------------------------------------------------
-- 2. update_expense: add date to payload
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
      'date', _date::text,
      'paidByDisplayName', _paid_by_display_name,
      'changes', _changes
    )
  );
END;
$$;

--------------------------------------------------------------------------------
-- 3. delete_expense: add _date and _participant_display_names to payload
--------------------------------------------------------------------------------

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
        'date', _date::text,
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
        'date', _date::text,
        'paidByDisplayName', _paid_by_display_name,
        'participantDisplayNames', to_jsonb(_participant_display_names)
      )
    );
  END IF;

  -- Delete expense (cascade deletes splits)
  DELETE FROM "Expense" WHERE id = _expense_id AND "groupId" = _group_id;
END;
$$;

--------------------------------------------------------------------------------
-- 4. create_payment: add date to payload
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
      'date', _date::text,
      'fromDisplayName', _from_display_name,
      'toDisplayName', _to_display_name
    )
  );

  RETURN _expense_id;
END;
$$;
