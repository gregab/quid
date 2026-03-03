import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateGroupBillItemSchema } from "@aviary/shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string; itemId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, billId, itemId } = await params;

  // Verify group membership
  const { data: members } = await supabase
    .from("GroupMember")
    .select("userId")
    .eq("groupId", groupId);

  if (!members || members.length === 0) {
    return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
  }

  const isMember = members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Parse and validate body
  const body: unknown = await request.json();
  const parsed = updateGroupBillItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { action, include, description, amountCents } = parsed.data;
  const effectiveAction = action ?? "toggle_claim";

  if (effectiveAction === "toggle_claim") {
    const { error: rpcError } = await supabase.rpc("toggle_group_bill_item_claim", {
      _item_id: itemId,
      _user_id: user.id,
    });

    if (rpcError) {
      return NextResponse.json({ data: null, error: rpcError.message }, { status: 500 });
    }

    // Return updated item
    const { data: updatedItem, error: fetchError } = await supabase
      .from("GroupBillItem")
      .select("*")
      .eq("id", itemId)
      .single();

    if (fetchError || !updatedItem) {
      return NextResponse.json({ data: null, error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updatedItem, error: null });
  }

  if (effectiveAction === "toggle_all") {
    const { error: rpcError } = await supabase.rpc("set_group_bill_member_all_items", {
      _bill_id: billId,
      _user_id: user.id,
      _include: include ?? true,
    });

    if (rpcError) {
      return NextResponse.json({ data: null, error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ data: null, error: null });
  }

  if (effectiveAction === "edit") {
    // Verify bill is in_progress
    const { data: bill, error: billError } = await supabase
      .from("GroupBill")
      .select("status")
      .eq("id", billId)
      .eq("groupId", groupId)
      .single();

    if (billError || !bill) {
      return NextResponse.json({ data: null, error: "Bill not found" }, { status: 404 });
    }

    if (bill.status !== "in_progress") {
      return NextResponse.json({ data: null, error: "Bill is already finalized" }, { status: 400 });
    }

    const updateData: { description?: string; amountCents?: number } = {};
    if (description !== undefined) updateData.description = description;
    if (amountCents !== undefined) updateData.amountCents = amountCents;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ data: null, error: "No fields to update" }, { status: 400 });
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("GroupBillItem")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError || !updatedItem) {
      return NextResponse.json({ data: null, error: updateError?.message ?? "Failed to update item" }, { status: 500 });
    }

    return NextResponse.json({ data: updatedItem, error: null });
  }

  return NextResponse.json({ data: null, error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string; itemId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, billId, itemId } = await params;

  // Verify group membership
  const { data: members } = await supabase
    .from("GroupMember")
    .select("userId")
    .eq("groupId", groupId);

  if (!members || members.length === 0) {
    return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
  }

  const isMember = members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Fetch bill and verify status
  const { data: bill, error: billError } = await supabase
    .from("GroupBill")
    .select("status")
    .eq("id", billId)
    .eq("groupId", groupId)
    .single();

  if (billError || !bill) {
    return NextResponse.json({ data: null, error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "in_progress") {
    return NextResponse.json({ data: null, error: "Bill is already finalized" }, { status: 400 });
  }

  // Fetch item and verify it's not a tax/tip item
  const { data: item, error: itemError } = await supabase
    .from("GroupBillItem")
    .select("isTaxOrTip")
    .eq("id", itemId)
    .eq("groupBillId", billId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ data: null, error: "Item not found" }, { status: 404 });
  }

  if (item.isTaxOrTip) {
    return NextResponse.json({ data: null, error: "Cannot delete tax or tip items" }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from("GroupBillItem")
    .delete()
    .eq("id", itemId);

  if (deleteError) {
    return NextResponse.json({ data: null, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ data: null, error: null });
}
