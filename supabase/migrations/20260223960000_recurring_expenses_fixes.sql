-- Migration: Fix process_due_recurring_expenses for correctness
--
-- Two bugs fixed:
--
-- 1. Concurrency: if the cron fires twice simultaneously, both runs would SELECT
--    the same rows and generate duplicate expenses. Fix: use FOR UPDATE SKIP LOCKED
--    so concurrent executions skip rows already being processed.
--
-- 2. Isolation: a failure mid-iteration (after INSERT INTO Expense but before
--    the activity log or nextDueDate UPDATE) would leave partial state. Fix: wrap
--    each iteration in a SAVEPOINT so failures roll back only that one record and
--    processing continues for the rest.

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
    FOR UPDATE SKIP LOCKED   -- prevents duplicate processing from concurrent cron runs
  LOOP
    -- Wrap each iteration in a savepoint so a single failure doesn't abort the batch
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

    EXCEPTION WHEN OTHERS THEN
      -- Log the error but continue processing remaining records
      RAISE WARNING 'process_due_recurring_expenses: failed for recurring_id=% with error: %', _rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN _processed;
END;
$$;
