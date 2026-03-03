import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
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

  if (bill.status !== "finalized") {
    return NextResponse.json({ data: null, error: "Bill is not finalized" }, { status: 400 });
  }

  if (!bill.expenseId) {
    return NextResponse.json({ data: null, error: "Bill has no associated expense" }, { status: 400 });
  }

  // Delete the expense directly (group membership already verified)
  const { error: deleteError } = await supabase
    .from("Expense")
    .delete()
    .eq("id", bill.expenseId);

  if (deleteError) {
    return NextResponse.json({ data: null, error: deleteError.message }, { status: 500 });
  }

  // Update GroupBill: clear expenseId and set status back to in_progress
  const { error: updateError } = await supabase
    .from("GroupBill")
    .update({ expenseId: null, status: "in_progress" })
    .eq("id", billId);

  if (updateError) {
    return NextResponse.json({ data: null, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ data: null, error: null });
}
