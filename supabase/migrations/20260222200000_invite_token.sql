-- Migration: Add inviteToken to Group table + RPCs for invite link feature

--------------------------------------------------------------------------------
-- 1. Add inviteToken column to Group
--------------------------------------------------------------------------------

ALTER TABLE "Group" ADD COLUMN "inviteToken" text
  DEFAULT replace(gen_random_uuid()::text, '-', '')
  NOT NULL;

-- Backfill any existing rows that got NULL (shouldn't happen with DEFAULT, but safe)
UPDATE "Group" SET "inviteToken" = replace(gen_random_uuid()::text, '-', '')
  WHERE "inviteToken" IS NULL;

-- Unique index for fast lookup by token
CREATE UNIQUE INDEX "Group_inviteToken_key" ON "Group" ("inviteToken");

--------------------------------------------------------------------------------
-- 2. RPC: get_group_by_invite_token
--    Returns group name/id/memberCount/isMember for the invite page preview.
--    SECURITY DEFINER so non-members can see group name (bypasses RLS).
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_group_by_invite_token(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group record;
  _member_count int;
  _is_member boolean;
BEGIN
  SELECT * INTO _group FROM "Group" WHERE "inviteToken" = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO _member_count FROM "GroupMember" WHERE "groupId" = _group.id;

  SELECT EXISTS(
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group.id AND "userId" = auth.uid()::text
  ) INTO _is_member;

  RETURN json_build_object(
    'id', _group.id,
    'name', _group.name,
    'memberCount', _member_count,
    'isMember', _is_member
  );
END;
$$;

--------------------------------------------------------------------------------
-- 3. RPC: join_group_by_token
--    Adds the caller as a group member (idempotent — safe if already a member).
--    SECURITY DEFINER so it can INSERT into GroupMember bypassing RLS.
--------------------------------------------------------------------------------

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
