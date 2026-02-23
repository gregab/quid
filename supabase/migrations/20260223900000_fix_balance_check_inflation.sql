-- Migration: Fix inflated balance check in leave_group and delete_account
--
-- Bug: Both RPCs computed a user's net balance via:
--   SELECT SUM(CASE WHEN paidById = user THEN amountCents END)
--        - SUM(CASE WHEN es.userId = user THEN es.amountCents END)
--   FROM Expense e LEFT JOIN ExpenseSplit es ON ...
--
-- The LEFT JOIN produces one row per expense-split pair. When the user is the
-- payer, amountCents gets summed once per split row, inflating the "paid" side
-- by a factor of (number of splits). This could let users with outstanding
-- debts slip past the guardrail checks.
--
-- Fix: Use separate subqueries for paid vs owed so each expense is counted once.

--------------------------------------------------------------------------------
-- 1. Fix leave_group
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION leave_group(_group_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _member_id text;
  _balance bigint;
  _remaining int;
  _display_name text;
BEGIN
  -- 1. Verify caller is a member
  SELECT id INTO _member_id
  FROM "GroupMember"
  WHERE "groupId" = _group_id AND "userId" = _user_id;

  IF _member_id IS NULL THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- 2. Compute caller's net balance (paid - owed)
  --    positive = user is owed money, negative = user owes money
  SELECT
    (SELECT COALESCE(SUM("amountCents"), 0)
     FROM "Expense"
     WHERE "groupId" = _group_id AND "paidById" = _user_id)
    -
    (SELECT COALESCE(SUM(es."amountCents"), 0)
     FROM "ExpenseSplit" es
     JOIN "Expense" e ON e.id = es."expenseId"
     WHERE e."groupId" = _group_id AND es."userId" = _user_id)
  INTO _balance;

  -- Only block if the user owes more than $2 (negative balance beyond threshold)
  IF _balance < -200 THEN
    RAISE EXCEPTION 'Cannot leave group: you owe $%. Please settle up first.',
      TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM TO_CHAR(ABS(_balance) / 100.0, 'FM999999990.00')));
  END IF;

  -- 3. Get display name for activity log
  SELECT "displayName" INTO _display_name
  FROM "User"
  WHERE id = _user_id;

  -- 4. Delete the GroupMember row
  DELETE FROM "GroupMember" WHERE id = _member_id;

  -- 5. Insert activity log entry
  INSERT INTO "ActivityLog" (id, "groupId", "actorId", action, payload)
  VALUES (
    gen_random_uuid()::text,
    _group_id,
    _user_id,
    'member_left',
    jsonb_build_object('displayName', _display_name)
  );

  -- 6. Count remaining members — if 0, delete the group (cascade handles rest)
  SELECT COUNT(*) INTO _remaining
  FROM "GroupMember"
  WHERE "groupId" = _group_id;

  IF _remaining = 0 THEN
    DELETE FROM "Group" WHERE id = _group_id;
    RETURN jsonb_build_object('deleted_group', true);
  END IF;

  RETURN jsonb_build_object('deleted_group', false);
END;
$$;

--------------------------------------------------------------------------------
-- 2. Fix delete_account
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _display_name text;
  _group record;
  _remaining int;
  _balance bigint;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Block deletion if user has any non-zero balance in any group.
  FOR _group IN
    SELECT gm."groupId"
    FROM "GroupMember" gm
    WHERE gm."userId" = _user_id
  LOOP
    SELECT
      (SELECT COALESCE(SUM("amountCents"), 0)
       FROM "Expense"
       WHERE "groupId" = _group."groupId" AND "paidById" = _user_id)
      -
      (SELECT COALESCE(SUM(es."amountCents"), 0)
       FROM "ExpenseSplit" es
       JOIN "Expense" e ON e.id = es."expenseId"
       WHERE e."groupId" = _group."groupId" AND es."userId" = _user_id)
    INTO _balance;

    IF _balance != 0 THEN
      RAISE EXCEPTION 'Cannot delete account: you have outstanding balances. Please settle up first.';
    END IF;
  END LOOP;

  -- 2. Get display name for activity logs.
  SELECT "displayName" INTO _display_name
  FROM "User"
  WHERE id = _user_id;

  -- 3. For each group: remove membership, log departure, delete group if now empty
  --    (cascade handles expenses/splits/logs for empty groups).
  FOR _group IN
    SELECT gm.id AS member_id, gm."groupId"
    FROM "GroupMember" gm
    WHERE gm."userId" = _user_id
  LOOP
    DELETE FROM "GroupMember" WHERE id = _group.member_id;

    INSERT INTO "ActivityLog" (id, "groupId", "actorId", action, payload)
    VALUES (
      gen_random_uuid()::text,
      _group."groupId",
      _user_id,
      'member_left',
      jsonb_build_object('displayName', _display_name)
    );

    SELECT COUNT(*) INTO _remaining
    FROM "GroupMember"
    WHERE "groupId" = _group."groupId";

    IF _remaining = 0 THEN
      DELETE FROM "Group" WHERE id = _group."groupId";
    END IF;
  END LOOP;

  -- 4. Clean up remaining FK references in non-empty groups.
  --    (Empty-group data was already cascade-deleted above.)

  -- ExpenseSplit rows where this user was a participant
  DELETE FROM "ExpenseSplit" WHERE "userId" = _user_id;

  -- ExpenseSplit rows for expenses this user paid (other members' splits)
  DELETE FROM "ExpenseSplit"
  WHERE "expenseId" IN (SELECT id FROM "Expense" WHERE "paidById" = _user_id);

  -- Expenses this user paid
  DELETE FROM "Expense" WHERE "paidById" = _user_id;

  -- Activity log entries authored by this user
  DELETE FROM "ActivityLog" WHERE "actorId" = _user_id;

  -- 5. Now safe to delete the User row.
  DELETE FROM "User" WHERE id = _user_id;
END;
$$;
