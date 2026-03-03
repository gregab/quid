import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeBillSplits } from "@aviary/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, billId } = await params;

  // Verify group membership and get members with display names
  const { data: members } = await supabase
    .from("GroupMember")
    .select("userId, User(displayName)")
    .eq("groupId", groupId);

  if (!members || members.length === 0) {
    return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
  }

  const isMember = members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Parse body
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null || !("paidById" in body) || typeof (body as Record<string, unknown>).paidById !== "string") {
    return NextResponse.json({ data: null, error: "paidById is required" }, { status: 400 });
  }
  const { paidById } = body as { paidById: string };

  // Validate paidById is a group member
  const paidByMember = members.find((m) => m.userId === paidById);
  if (!paidByMember) {
    return NextResponse.json({ data: null, error: "Payer is not a member of this group" }, { status: 400 });
  }

  // Fetch bill
  const { data: bill, error: billError } = await supabase
    .from("GroupBill")
    .select("*")
    .eq("id", billId)
    .eq("groupId", groupId)
    .single();

  if (billError || !bill) {
    return NextResponse.json({ data: null, error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "in_progress") {
    return NextResponse.json({ data: null, error: "Bill is already finalized" }, { status: 400 });
  }

  // Fetch all items
  const { data: items, error: itemsError } = await supabase
    .from("GroupBillItem")
    .select("*")
    .eq("groupBillId", billId);

  if (itemsError) {
    return NextResponse.json({ data: null, error: itemsError.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ data: null, error: "Bill has no items" }, { status: 400 });
  }

  // Compute per-person splits
  const splits = computeBillSplits(items);

  if (splits.length === 0) {
    return NextResponse.json({ data: null, error: "No items have been claimed" }, { status: 400 });
  }

  // Build member lookup map
  const memberMap = new Map(
    members.map((m) => [m.userId, m.User?.displayName ?? "Unknown"])
  );

  // Build participants and splits for create_expense RPC
  const participantIds = splits.map((s) => s.userId);
  const splitAmounts = splits.map((s) => s.amountCents);
  const participantDisplayNames = splits.map((s) => memberMap.get(s.userId) ?? "Unknown");
  const totalAmountCents = splits.reduce((sum, s) => sum + s.amountCents, 0);

  const paidByDisplayName = memberMap.get(paidById) ?? "Unknown";

  // Today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Call create_expense RPC
  const { data: expenseId, error: rpcError } = await supabase.rpc("create_expense", {
    _group_id: groupId,
    _description: bill.name,
    _amount_cents: totalAmountCents,
    _date: today,
    _paid_by_id: paidById,
    _participant_ids: participantIds,
    _paid_by_display_name: paidByDisplayName,
    _split_type: "custom",
    _split_amounts: splitAmounts,
    _participant_display_names: participantDisplayNames,
  });

  if (rpcError) {
    return NextResponse.json({ data: null, error: rpcError.message }, { status: 500 });
  }

  // Update GroupBill: set expenseId and status = 'finalized'
  const { error: updateError } = await supabase
    .from("GroupBill")
    .update({ expenseId, status: "finalized" })
    .eq("id", billId);

  if (updateError) {
    return NextResponse.json({ data: null, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { expenseId }, error: null }, { status: 200 });
}
