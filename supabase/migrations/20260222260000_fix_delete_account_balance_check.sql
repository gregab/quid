-- Migration: Tighten delete_account balance check
--
-- The previous fix blocked deletion only when user owes > $2 (balance < -200).
-- This allows users with small debts or any owed balances to slip through.
-- Change the check to block on any non-zero balance in any group.

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
      COALESCE(SUM(CASE WHEN e."paidById" = _user_id THEN e."amountCents" ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN es."userId" = _user_id THEN es."amountCents" ELSE 0 END), 0)
    INTO _balance
    FROM "Expense" e
    LEFT JOIN "ExpenseSplit" es ON es."expenseId" = e.id
    WHERE e."groupId" = _group."groupId";

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
