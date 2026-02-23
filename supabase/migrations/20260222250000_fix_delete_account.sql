-- Migration: Fix delete_account RPC
--
-- Two problems with the original:
-- 1. No balance check: users with outstanding debts could delete their account,
--    leaving groups with dangling financial records.
-- 2. FK constraint violation: DELETE FROM "User" fails when the user has expenses
--    in groups that still have other members (Expense.paidById, ExpenseSplit.userId,
--    ActivityLog.actorId all reference User.id with no ON DELETE CASCADE).
--
-- Fix:
-- - Block deletion if user owes > $2 in any group (mirrors leave_group threshold).
-- - After removing memberships, clean up all remaining FK references before
--   deleting the User row.

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

  -- 1. Check for outstanding debts in every group before doing anything.
  --    Block if user owes more than $2 in any single group.
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

    IF _balance < -200 THEN
      RAISE EXCEPTION 'Cannot delete account: you have outstanding debts. Please settle up first.';
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
