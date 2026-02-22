-- Migration: Add leave_group RPC + DELETE policy on GroupMember
-- Allows members to leave groups. Blocks leaving if |balance| > 200 cents ($2).
-- When the last member leaves, the group is deleted (cascade handles cleanup).

--------------------------------------------------------------------------------
-- 1. DELETE policy on GroupMember: members can remove themselves
--------------------------------------------------------------------------------

CREATE POLICY "Members can remove themselves"
  ON "GroupMember" FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);

--------------------------------------------------------------------------------
-- 2. leave_group RPC function
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
  --    paid = sum of expenses the user paid for in this group
  --    owed = sum of splits assigned to the user in this group
  SELECT
    COALESCE(SUM(CASE WHEN e."paidById" = _user_id THEN e."amountCents" ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN es."userId" = _user_id THEN es."amountCents" ELSE 0 END), 0)
  INTO _balance
  FROM "Expense" e
  LEFT JOIN "ExpenseSplit" es ON es."expenseId" = e.id
  WHERE e."groupId" = _group_id;

  IF ABS(_balance) > 200 THEN
    RAISE EXCEPTION 'Cannot leave group: you have an unsettled balance of $%. Please settle up first.',
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
