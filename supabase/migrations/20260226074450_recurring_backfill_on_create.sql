-- Migration: Backfill past-due recurring expenses at creation time
--
-- Two fixes:
--
-- 1. create_recurring_expense: After creating the first expense, if the start
--    date is in the past, immediately generate all past-due instances up to
--    today. Previously, past-due instances would trickle in one-per-cron-run.
--    Includes a safety cap of 52 backfill instances (1 year of weekly).
--
-- 2. process_due_recurring_expenses: Loop until fully caught up per template,
--    not just one instance per cron run. Also capped at 52 per template to
--    prevent runaway processing.

--------------------------------------------------------------------------------
-- 1. Recreate create_recurring_expense with backfill loop
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS create_recurring_expense(text, text, int, date, text, text[], text, text, int[], text[], text);

CREATE FUNCTION create_recurring_expense(
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
  _first_expense_id text;
  _participant_count int;
  _base_amount int;
  _remainder int;
  _i int;
  _splits_jsonb jsonb;
  _next_due date;
  _custom_splits_jsonb jsonb := NULL;
  _backfill_count int := 0;
  _max_backfill int := 52;  -- safety cap: max 1 year of weekly
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

  _participant_count := array_length(_participant_ids, 1);

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

  _first_expense_id := _expense_id;

  -- Create splits for first expense
  IF _split_amounts IS NOT NULL THEN
    FOR _i IN 1.._participant_count LOOP
      INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
      VALUES (_expense_id, _participant_ids[_i], _split_amounts[_i]);
    END LOOP;
  ELSE
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

  -- Activity log for first expense
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

  -- ── Backfill: generate all past-due instances up to today ──
  WHILE _next_due <= CURRENT_DATE AND _backfill_count < _max_backfill LOOP
    -- Create backfill Expense instance
    INSERT INTO "Expense" (
      "groupId", "paidById", description, "amountCents", date, "splitType",
      "createdById", "recurringExpenseId"
    )
    VALUES (
      _group_id, _paid_by_id, _description, _amount_cents, _next_due, _split_type,
      _user_id, _recurring_id
    )
    RETURNING id INTO _expense_id;

    -- Create splits for backfill expense
    IF _split_amounts IS NOT NULL THEN
      FOR _i IN 1.._participant_count LOOP
        INSERT INTO "ExpenseSplit" ("expenseId", "userId", "amountCents")
        VALUES (_expense_id, _participant_ids[_i], _split_amounts[_i]);
      END LOOP;
    ELSE
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

    -- Activity log for backfill expense (reuse same splits snapshot)
    INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
    VALUES (
      _group_id,
      _user_id,
      'expense_added',
      jsonb_build_object(
        'description', _description,
        'amountCents', _amount_cents,
        'date', _next_due::text,
        'paidByDisplayName', _paid_by_display_name,
        'splitType', _split_type,
        'splits', _splits_jsonb,
        'participantDisplayNames', to_jsonb(_participant_display_names)
      )
    );

    -- Advance nextDueDate
    CASE _frequency
      WHEN 'weekly'  THEN _next_due := _next_due + INTERVAL '7 days';
      WHEN 'monthly' THEN _next_due := _next_due + INTERVAL '1 month';
      WHEN 'yearly'  THEN _next_due := _next_due + INTERVAL '1 year';
    END CASE;

    _backfill_count := _backfill_count + 1;
  END LOOP;

  -- Persist final nextDueDate on the template
  UPDATE "RecurringExpense"
  SET "nextDueDate" = _next_due
  WHERE id = _recurring_id;

  RETURN _first_expense_id;
END;
$$;

--------------------------------------------------------------------------------
-- 2. Recreate process_due_recurring_expenses with loop-until-caught-up
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS process_due_recurring_expenses();

CREATE FUNCTION process_due_recurring_expenses()
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
  _current_next_due date;
  _iterations int;
  _max_iterations int := 52;  -- safety cap per template
BEGIN
  FOR _rec IN
    SELECT *
    FROM "RecurringExpense"
    WHERE "isActive" = true AND "nextDueDate" <= CURRENT_DATE
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
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

      _participant_count := array_length(_active_participant_ids, 1);
      _current_next_due := _rec."nextDueDate";
      _iterations := 0;

      -- Loop until this template is fully caught up (or hits safety cap)
      WHILE _current_next_due <= CURRENT_DATE AND _iterations < _max_iterations LOOP
        -- Create Expense instance
        INSERT INTO "Expense" (
          "groupId", "paidById", description, "amountCents", date,
          "splitType", "createdById", "recurringExpenseId"
        )
        VALUES (
          _rec."groupId", _rec."paidById", _rec.description, _rec."amountCents",
          _current_next_due,
          CASE WHEN _use_custom THEN 'custom' ELSE 'equal' END,
          _rec."createdById", _rec.id
        )
        RETURNING id INTO _expense_id;

        -- Create splits
        IF _use_custom THEN
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

        -- Activity log
        INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
        VALUES (
          _rec."groupId",
          _rec."createdById",
          'expense_added',
          jsonb_build_object(
            'description', _rec.description,
            'amountCents', _rec."amountCents",
            'date', _current_next_due::text,
            'paidByDisplayName', _paid_by_display_name,
            'splitType', _rec."splitType",
            'splits', _splits_jsonb
          )
        );

        -- Advance nextDueDate
        CASE _rec.frequency
          WHEN 'weekly'  THEN _current_next_due := _current_next_due + INTERVAL '7 days';
          WHEN 'monthly' THEN _current_next_due := _current_next_due + INTERVAL '1 month';
          WHEN 'yearly'  THEN _current_next_due := _current_next_due + INTERVAL '1 year';
        END CASE;

        _iterations := _iterations + 1;
        _processed := _processed + 1;
      END LOOP;

      -- Persist final nextDueDate
      UPDATE "RecurringExpense"
      SET "nextDueDate" = _current_next_due
      WHERE id = _rec.id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'process_due_recurring_expenses: failed for recurring_id=% with error: %', _rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN _processed;
END;
$$;
