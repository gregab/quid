-- Migration: Clean up stale function overloads + add CHECK/UNIQUE constraints
--
-- Problem: Each migration that changed a function's parameter list created a NEW
-- PostgreSQL overload (same name, different signature) instead of replacing the old
-- one. This left stale overloads with inconsistent auth checks in the database.
--
-- Fix: DROP all overloads of create_expense, update_expense, delete_expense, then
-- re-create each once with the final signature and all correct auth checks.
--
-- Also: drop leftover _prisma_migrations table, add CHECK constraints for data
-- integrity, and add a UNIQUE constraint on ExpenseSplit(expenseId, userId).

--------------------------------------------------------------------------------
-- 0. Drop leftover Prisma table
--------------------------------------------------------------------------------

DROP TABLE IF EXISTS "_prisma_migrations";

--------------------------------------------------------------------------------
-- 1. Drop ALL overloads of create_expense
--    Overload 1: 7 params (original from rls_and_rpc / restrict_expense_edits)
--    Overload 2: 9 params (from fix_create_expense_created_by)
--    Overload 3: 10 params (from enrich_splits_in_activity_log) — will be re-created
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS create_expense(text, text, int, date, text, text[], text);
DROP FUNCTION IF EXISTS create_expense(text, text, int, date, text, text[], text, text, int[]);
DROP FUNCTION IF EXISTS create_expense(text, text, int, date, text, text[], text, text, int[], text[]);

--------------------------------------------------------------------------------
-- 2. Drop ALL overloads of update_expense
--    Overload 1: 9 params (from strict_expense_creator_check — had creator check)
--    Overload 2: 11 params (from enrich_activity_log_payloads — MISSING creator check)
--    Overload 3: 13 params (from enrich_splits_in_activity_log — MISSING creator check)
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS update_expense(text, text, text, int, date, text, text[], text, jsonb);
DROP FUNCTION IF EXISTS update_expense(text, text, text, int, date, text, text[], text, jsonb, text, int[]);
DROP FUNCTION IF EXISTS update_expense(text, text, text, int, date, text, text[], text, jsonb, text, int[], jsonb, jsonb);

--------------------------------------------------------------------------------
-- 3. Drop ALL overloads of delete_expense
--    Overload 1: 5 params (from strict_expense_creator_check)
--    Overload 2: 7 params (from enrich_splits_in_activity_log) — will be re-created
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS delete_expense(text, text, text, int, text);
DROP FUNCTION IF EXISTS delete_expense(text, text, text, int, text, date, text[]);

--------------------------------------------------------------------------------
-- 4. Re-create create_expense (single version, 10 params)
--    Final signature from enrich_splits_in_activity_log with createdById.
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

  -- Build splits snapshot from the just-inserted rows
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
-- 5. Re-create update_expense (single version, 13 params)
--    Final signature from enrich_splits_in_activity_log WITH creator-only check
--    restored (was lost when custom_splits migration overwrote the function).
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

  -- Only the creator can edit. NULL createdById = unknown creator — block edit.
  IF _created_by_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Only the creator can edit this expense';
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
-- 6. Re-create delete_expense (single version, 7 params)
--    Final signature from enrich_splits_in_activity_log with consistent strict
--    creator check (IS DISTINCT FROM without IS NOT NULL guard, matching
--    update_expense behavior — all createdById values were backfilled).
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
END;
$$;

--------------------------------------------------------------------------------
-- 7. CHECK constraints
--------------------------------------------------------------------------------

-- Expense.splitType must be 'equal' or 'custom'
ALTER TABLE "Expense" ADD CONSTRAINT expense_split_type_check
  CHECK ("splitType" IN ('equal', 'custom'));

-- Expense.amountCents must be positive
ALTER TABLE "Expense" ADD CONSTRAINT expense_amount_cents_positive
  CHECK ("amountCents" > 0);

-- ExpenseSplit.amountCents must be non-negative (zero is valid for custom splits)
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT expense_split_amount_cents_nonneg
  CHECK ("amountCents" >= 0);

-- ActivityLog.action must be a known action type
ALTER TABLE "ActivityLog" ADD CONSTRAINT activity_log_action_check
  CHECK (action IN (
    'expense_added', 'expense_edited', 'expense_deleted',
    'payment_recorded', 'payment_deleted',
    'member_left'
  ));

--------------------------------------------------------------------------------
-- 8. UNIQUE constraint on ExpenseSplit(expenseId, userId)
--------------------------------------------------------------------------------

ALTER TABLE "ExpenseSplit" ADD CONSTRAINT expense_split_unique_per_user
  UNIQUE ("expenseId", "userId");
