-- RPC: add_member_by_email
-- Allows a group member to add another user to the group by their email address.
-- Replaces the multi-step API route flow with an atomic server-side operation,
-- enabling the mobile app to call this directly via supabase.rpc().

DROP FUNCTION IF EXISTS add_member_by_email(text, text);

CREATE FUNCTION add_member_by_email(_group_id text, _email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text := auth.uid()::text;
  _target_user_id text;
  _target_display_name text;
  _joined_at timestamptz;
BEGIN
  -- Auth check
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be a member of this group
  IF NOT EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id AND "userId" = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Look up user by email
  SELECT id, "displayName" INTO _target_user_id, _target_display_name
  FROM "User"
  WHERE email = _email;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with that email address';
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = _group_id AND "userId" = _target_user_id
  ) THEN
    RAISE EXCEPTION 'That user is already a member of this group';
  END IF;

  -- Add the member
  INSERT INTO "GroupMember" ("groupId", "userId")
  VALUES (_group_id, _target_user_id)
  RETURNING "joinedAt" INTO _joined_at;

  RETURN json_build_object(
    'userId', _target_user_id,
    'displayName', _target_display_name,
    'groupId', _group_id,
    'joinedAt', _joined_at
  );
END;
$$;
