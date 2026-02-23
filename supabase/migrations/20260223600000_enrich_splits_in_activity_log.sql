-- Migration: Enrich activity log payloads with full split snapshots
--
-- Adds splitType + splits (snapshot) to expense_added and expense_deleted payloads.
-- Adds splitsBefore + splits (after) to expense_edited payload via two new optional
-- _splits_before / _splits_after jsonb params.

--------------------------------------------------------------------------------
-- 1. create_expense: add splitType + splits snapshot to payload
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

  -- Build splits snapshot from the just-inserted rows (joined with User for display names)
  SELECT jsonb_agg(
    jsonb_build_object('displayName', u."displayName", 'amountCents', s."amountCents")
    ORDER BY s."userId"
  )
  INTO _splits_jsonb
  FROM "ExpenseSplit" s
  JOIN "User" u ON u.id = s."userId"
  WHERE s."expenseId" = _expense_id;

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
      'splitType', _split_type,
      'splits', _splits_jsonb,
      'participantDisplayNames', to_jsonb(_participant_display_names)
    )
  );

  RETURN _expense_id;
END;
$$;

--------------------------------------------------------------------------------
-- 2. update_expense: add _splits_before / _splits_after params to payload
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
  _split_amounts int[] DEFAULT NULL,
  _splits_before jsonb DEFAULT NULL,
  _splits_after jsonb DEFAULT NULL
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
      'splitType', _split_type,
      'splitsBefore', _splits_before,
      'splits', _splits_after,
      'changes', _changes
    )
  );
END;
$$;

--------------------------------------------------------------------------------
-- 3. delete_expense: query splits from DB before deletion; keep
--    _participant_display_names param as no-op for call-site compat
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
  _split_type_val text;
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

  -- Fetch expense metadata
  SELECT "isPayment", "createdById", "splitType"
  INTO _is_payment, _created_by_id, _split_type_val
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
END;
$$;
