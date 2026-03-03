import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseReceipt } from "@/lib/parseReceipt";
import type { GroupBillSummary } from "@aviary/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;

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

  // Fetch all bills for this group
  const { data: bills, error: billsError } = await supabase
    .from("GroupBill")
    .select("*")
    .eq("groupId", groupId)
    .order("createdAt", { ascending: false });

  if (billsError) {
    return NextResponse.json({ data: null, error: billsError.message }, { status: 500 });
  }

  if (!bills || bills.length === 0) {
    return NextResponse.json({ data: [] as GroupBillSummary[], error: null });
  }

  const billIds = bills.map((b) => b.id);

  // Fetch all items for those bills
  const { data: items, error: itemsError } = await supabase
    .from("GroupBillItem")
    .select("*")
    .in("groupBillId", billIds);

  if (itemsError) {
    return NextResponse.json({ data: null, error: itemsError.message }, { status: 500 });
  }

  // Compute counts in TypeScript
  const summaries: GroupBillSummary[] = bills.map((bill) => {
    const billItems = (items ?? []).filter((item) => item.groupBillId === bill.id);
    const itemCount = billItems.length;
    const unclaimedCount = billItems.filter(
      (item) => !item.isTaxOrTip && item.claimedByUserIds.length === 0
    ).length;

    return {
      id: bill.id,
      groupId: bill.groupId,
      name: bill.name,
      status: bill.status as "in_progress" | "finalized",
      expenseId: bill.expenseId,
      createdAt: bill.createdAt,
      receiptImageUrl: bill.receiptImageUrl,
      itemCount,
      unclaimedCount,
    };
  });

  return NextResponse.json({ data: summaries, error: null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Verify group membership and get all member IDs
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

  // Parse FormData
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const name = formData.get("name") as string | null;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ data: null, error: "Name is required" }, { status: 400 });
  }

  if (!image) {
    return NextResponse.json({ data: null, error: "Image is required" }, { status: 400 });
  }

  const mimeType = image.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(mimeType)) {
    return NextResponse.json({ data: null, error: "Invalid image type. Must be jpeg, png, webp, or gif" }, { status: 400 });
  }

  // Generate bill ID
  const billId = crypto.randomUUID();

  // Get file extension
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[mimeType] ?? "jpg";
  const storagePath = `${groupId}/${billId}.${ext}`;

  // Read image buffer
  const buffer = Buffer.from(await image.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Upload image to Supabase Storage (admin client bypasses storage RLS; auth already verified above)
  const adminSupabase = createAdminClient();
  const { error: uploadError } = await adminSupabase.storage
    .from("receipts")
    .upload(storagePath, buffer, { contentType: mimeType });

  if (uploadError) {
    return NextResponse.json({ data: null, error: `Failed to upload image: ${uploadError.message}` }, { status: 500 });
  }

  // Parse receipt with Claude
  let parseResult: Awaited<ReturnType<typeof parseReceipt>>;
  try {
    parseResult = await parseReceipt(base64, mimeType);
  } catch (err) {
    return NextResponse.json(
      { data: null, error: `Failed to parse receipt: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }

  // Insert GroupBill row
  const { data: bill, error: billError } = await supabase
    .from("GroupBill")
    .insert({
      id: billId,
      groupId,
      createdById: user.id,
      receiptImageUrl: storagePath,
      name: name.trim(),
      receiptType: parseResult.receiptType,
      status: "in_progress",
    })
    .select()
    .single();

  if (billError || !bill) {
    return NextResponse.json({ data: null, error: billError?.message ?? "Failed to create bill" }, { status: 500 });
  }

  // For 'other' receipt type, pre-populate claimedByUserIds with all member IDs
  const allMemberIds = members.map((m) => m.userId);

  // Insert GroupBillItem rows
  const itemInserts = parseResult.items.map((item, index) => ({
    groupBillId: billId,
    description: item.description,
    amountCents: item.amountCents,
    isTaxOrTip: item.isTaxOrTip,
    sortOrder: index,
    claimedByUserIds: parseResult.receiptType === "other" && !item.isTaxOrTip ? allMemberIds : [],
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("GroupBillItem")
    .insert(itemInserts)
    .select();

  if (itemsError) {
    return NextResponse.json({ data: null, error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        ...bill,
        items: insertedItems ?? [],
      },
      error: null,
    },
    { status: 201 }
  );
}
