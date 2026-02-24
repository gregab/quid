-- Migration: Recurring expenses feature
--
-- Adds:
--   1. RecurringExpense table (stores the template for auto-generating expenses)
--   2. recurringExpenseId FK column on Expense (links instances to their template)
--   3. create_recurring_expense RPC (user-facing: creates template + first instance)
--   4. stop_recurring_expense RPC (user-facing: deletes template, nullifies FK on instances)
--   5. process_due_recurring_expenses RPC (cron-facing: generates due instances)

--------------------------------------------------------------------------------
-- 1. Create RecurringExpense table
--------------------------------------------------------------------------------

CREATE TABLE "RecurringExpense" (
  "id"             text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "groupId"        text NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "createdById"    text NOT NULL REFERENCES "User"("id"),
  "description"    text NOT NULL,
  "amountCents"    integer NOT NULL CHECK ("amountCents" > 0),
  "paidById"       text NOT NULL REFERENCES "User"("id"),
  "participantIds" text[] NOT NULL,
  "splitType"      text NOT NULL DEFAULT 'equal' CHECK ("splitType" IN ('equal', 'custom')),
  "customSplits"   jsonb,           -- [{userId, amountCents}], null when equal
  "frequency"      text NOT NULL CHECK ("frequency" IN ('weekly', 'monthly', 'yearly')),
  "nextDueDate"    date NOT NULL,   -- date of next auto-generated expense
  "isActive"       boolean NOT NULL DEFAULT true,
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "RecurringExpense" ENABLE ROW LEVEL SECURITY;

-- Group members can read their recurring expenses
CREATE POLICY "recurring_expense_select_policy"
  ON "RecurringExpense"
  FOR SELECT
  USING (is_group_member("groupId"));

--------------------------------------------------------------------------------
-- 2. Add recurringExpenseId column to Expense
--    ON DELETE SET NULL: deleting the template nullifies FK on past instances
--    (badge disappears — correct, they're no longer part of an active series)
--------------------------------------------------------------------------------

ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "recurringExpenseId" text
  REFERENCES "RecurringExpense"("id") ON DELETE SET NULL;

--------------------------------------------------------------------------------
-- 3. create_recurring_expense RPC
--    Creates the RecurringExpense template + first Expense instance atomically.
--    nextDueDate is set to first_date + frequency (not the first_date itself,
--    so the cron won't immediately generate a duplicate).
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_recurring_expense(
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text,
  _split_type text DEFAULT 'equal',
  _split_amounts int[] DEFAULT NULL,
  _participant_display_names text[] DEFAULT NULL,
  _frequency text DEFAULT 'monthly'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _recurring_id text;
  _expense_id text;
  _participant_count int;
  _base_amount int;
  _remainder int;
  _i int;
  _splits_jsonb jsonb;
  _next_due date;
  _custom_splits_jsonb jsonb := NULL;
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

  -- Build customSplits jsonb from arrays if custom
  IF _split_type = 'custom' AND _split_amounts IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object('userId', _participant_ids[i], 'amountCents', _split_amounts[i])
    )
    INTO _custom_splits_jsonb
    FROM generate_series(1, array_length(_participant_ids, 1)) AS i;
  END IF;

  -- Calculate nextDueDate: first occurrence AFTER the initial expense date
  CASE _frequency
    WHEN 'weekly'  THEN _next_due := _date + INTERVAL '7 days';
    WHEN 'monthly' THEN _next_due := _date + INTERVAL '1 month';
    WHEN 'yearly'  THEN _next_due := _date + INTERVAL '1 year';
    ELSE RAISE EXCEPTION 'Invalid frequency: %', _frequency;
  END CASE;

  -- Create RecurringExpense template
  INSERT INTO "RecurringExpense" (
    "groupId", "createdById", description, "amountCents", "paidById",
    "participantIds", "splitType", "customSplits", frequency, "nextDueDate"
  )
  VALUES (
    _group_id, _user_id, _description, _amount_cents, _paid_by_id,
    _participant_ids, _split_type, _custom_splits_jsonb, _frequency, _next_due
  )
  RETURNING id INTO _recurring_id;

  -- Create first Expense instance linked to the template
  INSERT INTO "Expense" (
    "groupId", "paidById", description, "amountCents", date, "splitType",
    "createdById", "recurringExpenseId"
  )
  VALUES (
    _group_id, _paid_by_id, _description, _amount_cents, _date, _split_type,
    _user_id, _recurring_id
  )
  RETURNING id INTO _expense_id;

  -- Create splits
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

  -- Build splits snapshot for activity log
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
-- 4. stop_recurring_expense RPC
--    Deletes the template; ON DELETE SET NULL nullifies recurringExpenseId on
--    all past instances (badge disappears — they're no longer in an active series).
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stop_recurring_expense(_recurring_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _group_id text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the group for this recurring expense
  SELECT "groupId" INTO _group_id
  FROM "RecurringExpense"
  WHERE id = _recurring_id;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Recurring expense not found';
  END IF;

  -- Verify caller is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id AND "userId" = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Delete the template (FK ON DELETE SET NULL handles existing expense instances)
  DELETE FROM "RecurringExpense" WHERE id = _recurring_id;
END;
$$;

--------------------------------------------------------------------------------
-- 5. process_due_recurring_expenses RPC
--    Called by trusted cron job (admin client, no auth.uid() check).
--    Finds all active templates with nextDueDate <= today, generates a new
--    Expense + splits + activity log for each, then advances nextDueDate.
--
--    Deactivation rules:
--      - paidById no longer a group member → deactivate
--      - no original participants are still group members → deactivate
--    Custom splits: only used if ALL original participants are still members
--    (otherwise falls back to equal split among remaining members).
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_due_recurring_expenses()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _expense_id text;
  _participant_count int;
  _base_amount int;
  _remainder int;
  _i int;
  _active_participant_ids text[];
  _paid_by_exists boolean;
  _splits_jsonb jsonb;
  _paid_by_display_name text;
  _processed int := 0;
  _use_custom boolean;
BEGIN
  FOR _rec IN
    SELECT *
    FROM "RecurringExpense"
    WHERE "isActive" = true AND "nextDueDate" <= CURRENT_DATE
  LOOP
    -- Check paidById is still a group member
    SELECT EXISTS (
      SELECT 1 FROM "GroupMember"
      WHERE "groupId" = _rec."groupId" AND "userId" = _rec."paidById"
    ) INTO _paid_by_exists;

    IF NOT _paid_by_exists THEN
      UPDATE "RecurringExpense" SET "isActive" = false WHERE id = _rec.id;
      CONTINUE;
    END IF;

    -- Filter participantIds to current group members only
    SELECT ARRAY(
      SELECT pid
      FROM unnest(_rec."participantIds") AS pid
      WHERE EXISTS (
        SELECT 1 FROM "GroupMember"
        WHERE "groupId" = _rec."groupId" AND "userId" = pid
      )
    ) INTO _active_participant_ids;

    IF _active_participant_ids IS NULL OR array_length(_active_participant_ids, 1) IS NULL THEN
      UPDATE "RecurringExpense" SET "isActive" = false WHERE id = _rec.id;
      CONTINUE;
    END IF;

    -- Use custom splits only if ALL original participants are still active
    _use_custom := (
      _rec."splitType" = 'custom'
      AND _rec."customSplits" IS NOT NULL
      AND array_length(_active_participant_ids, 1) = array_length(_rec."participantIds", 1)
    );

    -- Create Expense instance
    INSERT INTO "Expense" (
      "groupId", "paidById", description, "amountCents", date,
      "splitType", "createdById", "recurringExpenseId"
    )
    VALUES (
      _rec."groupId", _rec."paidById", _rec.description, _rec."amountCents",
      _rec."nextDueDate",
      CASE WHEN _use_custom THEN 'custom' ELSE 'equal' END,
      _rec."createdById", _rec.id
    )
    RETURNING id INTO _expense_id;

    -- Create splits
    _participant_count := array_length(_active_participant_ids, 1);

    IF _use_custom THEN
      -- Custom: use stored amounts
      FOR _i IN 1.._participant_count LOOP
        INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
        VALUES (
          _expense_id,
          _active_participant_ids[_i],
          COALESCE(
            (SELECT (elem->>'amountCents')::int
             FROM jsonb_array_elements(_rec."customSplits") AS elem
             WHERE elem->>'userId' = _active_participant_ids[_i]),
            0
          )
        );
      END LOOP;
    ELSE
      -- Equal split
      _base_amount := _rec."amountCents" / _participant_count;
      _remainder := _rec."amountCents" % _participant_count;
      FOR _i IN 1.._participant_count LOOP
        INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
        VALUES (
          _expense_id,
          _active_participant_ids[_i],
          _base_amount + CASE WHEN _i <= _remainder THEN 1 ELSE 0 END
        );
      END LOOP;
    END IF;

    -- Build splits snapshot for activity log
    SELECT jsonb_agg(
      jsonb_build_object('displayName', u."displayName", 'amountCents', s."amountCents")
      ORDER BY s."userId"
    )
    INTO _splits_jsonb
    FROM "ExpenseSplit" s
    JOIN "User" u ON u.id = s."userId"
    WHERE s."expenseId" = _expense_id;

    -- Get paidBy display name
    SELECT "displayName" INTO _paid_by_display_name
    FROM "User" WHERE id = _rec."paidById";

    -- Activity log (actor = createdById = original creator)
    INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
    VALUES (
      _rec."groupId",
      _rec."createdById",
      'expense_added',
      jsonb_build_object(
        'description', _rec.description,
        'amountCents', _rec."amountCents",
        'date', _rec."nextDueDate"::text,
        'paidByDisplayName', _paid_by_display_name,
        'splitType', _rec."splitType",
        'splits', _splits_jsonb
      )
    );

    -- Advance nextDueDate by one frequency period
    CASE _rec.frequency
      WHEN 'weekly'  THEN
        UPDATE "RecurringExpense" SET "nextDueDate" = "nextDueDate" + INTERVAL '7 days' WHERE id = _rec.id;
      WHEN 'monthly' THEN
        UPDATE "RecurringExpense" SET "nextDueDate" = "nextDueDate" + INTERVAL '1 month' WHERE id = _rec.id;
      WHEN 'yearly'  THEN
        UPDATE "RecurringExpense" SET "nextDueDate" = "nextDueDate" + INTERVAL '1 year' WHERE id = _rec.id;
    END CASE;

    _processed := _processed + 1;
  END LOOP;

  RETURN _processed;
END;
$$;
