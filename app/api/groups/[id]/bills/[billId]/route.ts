import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
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

  // Fetch the bill
  const { data: bill, error: billError } = await supabase
    .from("GroupBill")
    .select("*")
    .eq("id", billId)
    .eq("groupId", groupId)
    .single();

  if (billError || !bill) {
    return NextResponse.json({ data: null, error: "Bill not found" }, { status: 404 });
  }

  // Fetch items ordered by sortOrder
  const { data: items, error: itemsError } = await supabase
    .from("GroupBillItem")
    .select("*")
    .eq("groupBillId", billId)
    .order("sortOrder", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ data: null, error: itemsError.message }, { status: 500 });
  }

  // Generate signed URL for receipt image (admin client bypasses storage RLS; auth already verified above)
  let receiptImageSignedUrl: string | null = null;
  if (bill.receiptImageUrl) {
    const adminSupabase = createAdminClient();
    const { data: signedData } = await adminSupabase.storage
      .from("receipts")
      .createSignedUrl(bill.receiptImageUrl, 3600);
    receiptImageSignedUrl = signedData?.signedUrl ?? null;
  }

  return NextResponse.json({
    data: {
      ...bill,
      items: items ?? [],
      receiptImageSignedUrl,
    },
    error: null,
  });
}
