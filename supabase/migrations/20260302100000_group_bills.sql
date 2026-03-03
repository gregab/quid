-- Migration: Group Bills (Receipt Scanning)
--
-- Adds GroupBill and GroupBillItem tables for the receipt scanning feature.
-- Users can upload a receipt photo, parse line items, claim items they ordered,
-- and finalize the bill into a group expense.
--
-- NOTE: All id/FK columns are text (not uuid) — consistent with the rest of the schema.
-- See 20260222000000_rls_and_rpc.sql for the original explanation.

--------------------------------------------------------------------------------
-- 1. GroupBill table
--    One row per scanned receipt. Tracks status from in_progress → finalized.
--------------------------------------------------------------------------------

CREATE TABLE "GroupBill" (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "groupId"           text NOT NULL REFERENCES "Group"(id) ON DELETE CASCADE,
  "createdById"       text NOT NULL REFERENCES "User"(id),
  "receiptImageUrl"   text NOT NULL,
  name                text NOT NULL,
  "receiptType"       text NOT NULL,  -- 'meal' | 'other'
  status              text NOT NULL DEFAULT 'in_progress',  -- 'in_progress' | 'finalized'
  "expenseId"         text REFERENCES "Expense"(id) ON DELETE SET NULL,
  "createdAt"         timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 2. GroupBillItem table
--    One row per line item on the receipt.
--------------------------------------------------------------------------------

CREATE TABLE "GroupBillItem" (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "groupBillId"       text NOT NULL REFERENCES "GroupBill"(id) ON DELETE CASCADE,
  description         text NOT NULL,
  "amountCents"       int NOT NULL,
  "isTaxOrTip"        bool NOT NULL DEFAULT false,
  "claimedByUserIds"  text[] NOT NULL DEFAULT '{}',
  "sortOrder"         int NOT NULL
);

--------------------------------------------------------------------------------
-- 3. Indexes
--------------------------------------------------------------------------------

CREATE INDEX ON "GroupBill"("groupId", status);
CREATE INDEX ON "GroupBillItem"("groupBillId", "sortOrder");

--------------------------------------------------------------------------------
-- 4. RLS Policies
--------------------------------------------------------------------------------

ALTER TABLE "GroupBill" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GroupBill access by group members" ON "GroupBill"
  FOR ALL TO authenticated
  USING (is_group_member("groupId"));

ALTER TABLE "GroupBillItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GroupBillItem access by group members" ON "GroupBillItem"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "GroupBill" gb
      WHERE gb.id = "GroupBillItem"."groupBillId"
        AND is_group_member(gb."groupId")
    )
  );

--------------------------------------------------------------------------------
-- 5. RPC: toggle_group_bill_item_claim
--    Atomically adds or removes a user from a GroupBillItem's claimedByUserIds.
--    Only the authenticated user can toggle their own claim.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION toggle_group_bill_item_claim(
  _item_id text,
  _user_id text
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id text := auth.uid()::text;
  _group_id text;
  _new_claimed text[];
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the user themselves can toggle their own claim
  IF _caller_id != _user_id THEN
    RAISE EXCEPTION 'Can only toggle your own claim';
  END IF;

  -- Get the group_id via join
  SELECT gb."groupId" INTO _group_id
  FROM "GroupBillItem" gbi
  JOIN "GroupBill" gb ON gb.id = gbi."groupBillId"
  WHERE gbi.id = _item_id;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- Validate group membership
  IF NOT is_group_member(_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Atomically toggle
  UPDATE "GroupBillItem"
  SET "claimedByUserIds" =
    CASE
      WHEN _user_id = ANY("claimedByUserIds") THEN array_remove("claimedByUserIds", _user_id)
      ELSE array_append("claimedByUserIds", _user_id)
    END
  WHERE id = _item_id
  RETURNING "claimedByUserIds" INTO _new_claimed;

  RETURN _new_claimed;
END;
$$;

--------------------------------------------------------------------------------
-- 6. RPC: set_group_bill_member_all_items
--    Adds or removes a user from ALL non-tax/tip items in a bill at once.
--    Used for "I'm in for everything" / "Remove me from all" actions.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_group_bill_member_all_items(
  _bill_id text,
  _user_id text,
  _include bool
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id text := auth.uid()::text;
  _group_id text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT "groupId" INTO _group_id FROM "GroupBill" WHERE id = _bill_id;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF NOT is_group_member(_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF _include THEN
    UPDATE "GroupBillItem"
    SET "claimedByUserIds" =
      CASE
        WHEN _user_id = ANY("claimedByUserIds") THEN "claimedByUserIds"
        ELSE array_append("claimedByUserIds", _user_id)
      END
    WHERE "groupBillId" = _bill_id AND "isTaxOrTip" = false;
  ELSE
    UPDATE "GroupBillItem"
    SET "claimedByUserIds" = array_remove("claimedByUserIds", _user_id)
    WHERE "groupBillId" = _bill_id AND "isTaxOrTip" = false;
  END IF;
END;
$$;
