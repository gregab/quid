-- Migration: Enable RLS on all tables + create RPC functions for atomic operations
-- This migration is safe to apply while Prisma is still in use (Prisma connects as
-- the postgres role which bypasses RLS).
--
-- NOTE: All id/FK columns are text (not uuid) because Prisma's @default(uuid())
-- generates UUIDs client-side as strings. We add gen_random_uuid()::text defaults
-- so Supabase JS inserts work without supplying ids.

--------------------------------------------------------------------------------
-- 0. Add gen_random_uuid() defaults to all id columns
--------------------------------------------------------------------------------

ALTER TABLE "User"         ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Group"        ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "GroupMember"  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Expense"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ExpenseSplit"  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ActivityLog"  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

--------------------------------------------------------------------------------
-- 1. Helper function: check if the current auth user is a member of a group
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_group_member(_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id
      AND "userId" = auth.uid()::text
  );
$$;

--------------------------------------------------------------------------------
-- 2. Enable RLS on all tables
--------------------------------------------------------------------------------

ALTER TABLE "User"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseSplit"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog"  ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3. RLS policies
--------------------------------------------------------------------------------

-- User table
CREATE POLICY "Users can read any authenticated user"
  ON "User" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own record"
  ON "User" FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid()::text);

CREATE POLICY "Users can update own record"
  ON "User" FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Group table
CREATE POLICY "Members can read their groups"
  ON "Group" FOR SELECT
  TO authenticated
  USING (is_group_member(id));

CREATE POLICY "Authenticated users can create groups"
  ON "Group" FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- GroupMember table
CREATE POLICY "Members can read fellow group members"
  ON "GroupMember" FOR SELECT
  TO authenticated
  USING (is_group_member("groupId"));

CREATE POLICY "Members can add to their groups"
  ON "GroupMember" FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member("groupId"));

-- Expense table
CREATE POLICY "Members can read group expenses"
  ON "Expense" FOR SELECT
  TO authenticated
  USING (is_group_member("groupId"));

CREATE POLICY "Members can create group expenses"
  ON "Expense" FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member("groupId"));

CREATE POLICY "Members can update group expenses"
  ON "Expense" FOR UPDATE
  TO authenticated
  USING (is_group_member("groupId"))
  WITH CHECK (is_group_member("groupId"));

CREATE POLICY "Members can delete group expenses"
  ON "Expense" FOR DELETE
  TO authenticated
  USING (is_group_member("groupId"));

-- ExpenseSplit table
CREATE POLICY "Members can read expense splits"
  ON "ExpenseSplit" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Expense"
      WHERE "Expense".id = "ExpenseSplit"."expenseId"
        AND is_group_member("Expense"."groupId")
    )
  );

CREATE POLICY "Members can create expense splits"
  ON "ExpenseSplit" FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Expense"
      WHERE "Expense".id = "ExpenseSplit"."expenseId"
        AND is_group_member("Expense"."groupId")
    )
  );

CREATE POLICY "Members can delete expense splits"
  ON "ExpenseSplit" FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Expense"
      WHERE "Expense".id = "ExpenseSplit"."expenseId"
        AND is_group_member("Expense"."groupId")
    )
  );

-- ActivityLog table
CREATE POLICY "Members can read group activity"
  ON "ActivityLog" FOR SELECT
  TO authenticated
  USING (is_group_member("groupId"));

CREATE POLICY "Members can create group activity"
  ON "ActivityLog" FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member("groupId"));

--------------------------------------------------------------------------------
-- 4. RPC functions (SECURITY DEFINER — bypass RLS, do their own auth checks)
--------------------------------------------------------------------------------

-- 4a. create_group: create group + add creator as first member
CREATE OR REPLACE FUNCTION create_group(_name text)
RETURNS text
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

  INSERT INTO "Group" (name, "createdById")
  VALUES (_name, _user_id)
  RETURNING id INTO _group_id;

  INSERT INTO "GroupMember" ("groupId", "userId")
  VALUES (_group_id, _user_id);

  RETURN _group_id;
END;
$$;

-- 4b. create_expense: create expense + splits + activity log atomically
CREATE OR REPLACE FUNCTION create_expense(
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text
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
  INSERT INTO "Expense" ("groupId", "paidById", description, "amountCents", date)
  VALUES (_group_id, _paid_by_id, _description, _amount_cents, _date)
  RETURNING id INTO _expense_id;

  -- Compute and create splits
  _participant_count := array_length(_participant_ids, 1);
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

  -- Activity log
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'expense_added',
    jsonb_build_object(
      'description', _description,
      'amountCents', _amount_cents,
      'paidByDisplayName', _paid_by_display_name
    )
  );

  RETURN _expense_id;
END;
$$;

-- 4c. update_expense: update expense + replace splits + activity log atomically
CREATE OR REPLACE FUNCTION update_expense(
  _expense_id text,
  _group_id text,
  _description text,
  _amount_cents int,
  _date date,
  _paid_by_id text,
  _participant_ids text[],
  _paid_by_display_name text,
  _changes jsonb
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
      "paidById" = _paid_by_id
  WHERE id = _expense_id AND "groupId" = _group_id;

  -- Delete old splits and create new ones
  DELETE FROM "ExpenseSplit" WHERE "expenseId" = _expense_id;

  _participant_count := array_length(_participant_ids, 1);
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

  -- Activity log
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'expense_edited',
    jsonb_build_object(
      'description', _description,
      'amountCents', _amount_cents,
      'paidByDisplayName', _paid_by_display_name,
      'changes', _changes
    )
  );
END;
$$;

-- 4d. delete_expense: log + delete (cascade handles splits)
CREATE OR REPLACE FUNCTION delete_expense(
  _expense_id text,
  _group_id text,
  _description text,
  _amount_cents int,
  _paid_by_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
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

  -- Activity log first (before the expense is gone)
  INSERT INTO "ActivityLog" ("groupId", "actorId", action, payload)
  VALUES (
    _group_id,
    _user_id,
    'expense_deleted',
    jsonb_build_object(
      'description', _description,
      'amountCents', _amount_cents,
      'paidByDisplayName', _paid_by_display_name
    )
  );

  -- Delete expense (cascade deletes splits)
  DELETE FROM "Expense" WHERE id = _expense_id AND "groupId" = _group_id;
END;
$$;
