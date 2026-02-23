-- Migration: Add delete_account RPC function
-- Removes user from all groups, logs departures, auto-deletes empty groups, then deletes User row.
-- Unlike leave_group, this does NOT enforce the $2 balance check — account deletion always proceeds.
-- Auth user deletion is handled by the API route via the admin client.

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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get display name for activity logs
  SELECT "displayName" INTO _display_name
  FROM "User"
  WHERE id = _user_id;

  -- For each group the user is in: remove membership, log it, delete empty groups
  FOR _group IN
    SELECT gm.id AS member_id, gm."groupId"
    FROM "GroupMember" gm
    WHERE gm."userId" = _user_id
  LOOP
    -- Delete the membership
    DELETE FROM "GroupMember" WHERE id = _group.member_id;

    -- Log the departure
    INSERT INTO "ActivityLog" (id, "groupId", "actorId", action, payload)
    VALUES (
      gen_random_uuid()::text,
      _group."groupId",
      _user_id,
      'member_left',
      jsonb_build_object('displayName', _display_name)
    );

    -- If group is now empty, delete it (cascade handles expenses, splits, logs)
    SELECT COUNT(*) INTO _remaining
    FROM "GroupMember"
    WHERE "groupId" = _group."groupId";

    IF _remaining = 0 THEN
      DELETE FROM "Group" WHERE id = _group."groupId";
    END IF;
  END LOOP;

  -- Delete the User row (orphaned expenses/activity logs retain paidById/actorId references)
  DELETE FROM "User" WHERE id = _user_id;
END;
$$;
