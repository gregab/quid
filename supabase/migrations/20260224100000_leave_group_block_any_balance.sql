-- Migration: Block leaving group when user has ANY outstanding balance
--
-- Previously, leave_group only blocked when user owed money (negative balance).
-- Now it blocks when user is owed money too — they should settle up first
-- to avoid leaving debts unresolvable for other members.

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

  -- Block if balance is nonzero in either direction (owe or owed)
  IF ABS(_balance) > 200 THEN
    RAISE EXCEPTION 'Cannot leave group: you have an outstanding balance of $%. Please settle up first.',
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
