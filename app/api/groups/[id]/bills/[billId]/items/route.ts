import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGroupBillItemSchema } from "@aviary/shared";

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
    .select("id, status, groupId")
    .eq("id", billId)
    .eq("groupId", groupId)
    .single();

  if (billError || !bill) {
    return NextResponse.json({ data: null, error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "in_progress") {
    return NextResponse.json({ data: null, error: "Bill is already finalized" }, { status: 400 });
  }

  // Get current max sortOrder
  const { data: existingItems } = await supabase
    .from("GroupBillItem")
    .select("sortOrder")
    .eq("groupBillId", billId)
    .order("sortOrder", { ascending: false })
    .limit(1);

  const maxSortOrder = existingItems && existingItems.length > 0 ? (existingItems[0].sortOrder ?? 0) : -1;
  const nextSortOrder = maxSortOrder + 1;

  // Parse and validate body
  const body: unknown = await request.json();
  const parsed = createGroupBillItemSchema.safeParse({
    ...(body as object),
    sortOrder: nextSortOrder,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Insert new item
  const { data: item, error: insertError } = await supabase
    .from("GroupBillItem")
    .insert({
      groupBillId: billId,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      isTaxOrTip: parsed.data.isTaxOrTip,
      sortOrder: parsed.data.sortOrder,
      claimedByUserIds: [],
    })
    .select()
    .single();

  if (insertError || !item) {
    return NextResponse.json({ data: null, error: insertError?.message ?? "Failed to create item" }, { status: 500 });
  }

  return NextResponse.json({ data: item, error: null }, { status: 201 });
}
