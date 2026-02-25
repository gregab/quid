-- Drop the always-true INSERT policy on Group.
-- Group creation goes through the create_group RPC (SECURITY DEFINER),
-- which bypasses RLS entirely. This policy was unused and flagged as
-- a security warning since WITH CHECK (true) allows unrestricted inserts.

DROP POLICY "Authenticated users can create groups" ON "Group";
