-- Migration: Friend groups
--
-- Adds isFriendGroup column to Group table and get_or_create_friend_group RPC.
-- Also blocks invite-join for friend groups.

--------------------------------------------------------------------------------
-- 1. Add isFriendGroup column
--------------------------------------------------------------------------------

ALTER TABLE "Group" ADD COLUMN "isFriendGroup" boolean NOT NULL DEFAULT false;

--------------------------------------------------------------------------------
-- 2. RPC: get_or_create_friend_group
--    Finds or creates a 2-person friend group between the caller and another user.
--    Uses advisory lock to prevent concurrent duplicate creation.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_or_create_friend_group(_other_user_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _group_id text;
  _lock_key bigint;
  _sorted_ids text[];
BEGIN
  -- Must be authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot create a friend group with yourself
  IF _other_user_id = _user_id THEN
    RAISE EXCEPTION 'Cannot create a friend group with yourself';
  END IF;

  -- Verify the other user exists
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = _other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Sort user IDs for deterministic locking and lookup
  IF _user_id < _other_user_id THEN
    _sorted_ids := ARRAY[_user_id, _other_user_id];
  ELSE
    _sorted_ids := ARRAY[_other_user_id, _user_id];
  END IF;

  -- Advisory lock on hash of both user IDs to prevent concurrent creation
  _lock_key := hashtext(_sorted_ids[1] || ':' || _sorted_ids[2]);
  PERFORM pg_advisory_xact_lock(_lock_key);

  -- Look for existing friend group with both users
  SELECT g.id INTO _group_id
  FROM "Group" g
  WHERE g."isFriendGroup" = true
    AND EXISTS (SELECT 1 FROM "GroupMember" WHERE "groupId" = g.id AND "userId" = _sorted_ids[1])
    AND EXISTS (SELECT 1 FROM "GroupMember" WHERE "groupId" = g.id AND "userId" = _sorted_ids[2]);

  IF _group_id IS NOT NULL THEN
    RETURN _group_id;
  END IF;

  -- Create new friend group
  -- Name is "User A & User B" using display names
  INSERT INTO "Group" (name, "isFriendGroup", "createdById")
  VALUES (
    (SELECT "displayName" FROM "User" WHERE id = _user_id) || ' & ' ||
    (SELECT "displayName" FROM "User" WHERE id = _other_user_id),
    true,
    _user_id
  )
  RETURNING id INTO _group_id;

  -- Add both users as members
  INSERT INTO "GroupMember" ("groupId", "userId") VALUES (_group_id, _user_id);
  INSERT INTO "GroupMember" ("groupId", "userId") VALUES (_group_id, _other_user_id);

  RETURN _group_id;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Update join_group_by_token to block friend group joins
--    Must DROP + CREATE since we're changing behavior (not signature).
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS join_group_by_token(text);

CREATE OR REPLACE FUNCTION join_group_by_token(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group record;
  _user_id text := auth.uid()::text;
  _existing record;
BEGIN
  -- Must be authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _group FROM "Group" WHERE "inviteToken" = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;

  -- Block joining friend groups via invite link
  IF _group."isFriendGroup" THEN
    RAISE EXCEPTION 'Cannot join a friend group via invite link';
  END IF;

  -- Check if already a member (idempotent)
  SELECT * INTO _existing FROM "GroupMember"
    WHERE "groupId" = _group.id AND "userId" = _user_id;
  IF FOUND THEN
    RETURN json_build_object('groupId', _group.id, 'alreadyMember', true);
  END IF;

  -- Add as member
  INSERT INTO "GroupMember" ("groupId", "userId") VALUES (_group.id, _user_id);

  RETURN json_build_object('groupId', _group.id, 'alreadyMember', false);
END;
$$;
