import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroupBillClient } from "../../GroupBillClient";
import type { GroupBillItem, Member } from "../../GroupBillClient";

export default async function GroupBillPage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { id: groupId, billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify group membership
  const { data: groupMembers } = await supabase
    .from("GroupMember")
    .select("userId, User(*)")
    .eq("groupId", groupId);

  if (!groupMembers || groupMembers.length === 0) redirect("/dashboard");

  const isMember = groupMembers.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  // Fetch bill
  const { data: bill, error: billError } = await supabase
    .from("GroupBill")
    .select("*")
    .eq("id", billId)
    .eq("groupId", groupId)
    .single();

  if (billError || !bill) redirect(`/groups/${groupId}`);

  // Fetch items ordered by sortOrder
  const { data: rawItems } = await supabase
    .from("GroupBillItem")
    .select("*")
    .eq("groupBillId", billId)
    .order("sortOrder", { ascending: true });

  // Generate signed URL for receipt image (admin client bypasses storage RLS; auth already verified above)
  let receiptImageSignedUrl: string | null = null;
  if (bill.receiptImageUrl) {
    const adminSupabase = createAdminClient();
    const { data: signedData } = await adminSupabase.storage
      .from("receipts")
      .createSignedUrl(bill.receiptImageUrl, 3600);
    receiptImageSignedUrl = signedData?.signedUrl ?? null;
  }

  const items: GroupBillItem[] = (rawItems ?? []).map((item) => ({
    id: item.id,
    groupBillId: item.groupBillId,
    description: item.description,
    amountCents: item.amountCents,
    isTaxOrTip: item.isTaxOrTip,
    claimedByUserIds: (item.claimedByUserIds ?? []) as string[],
    sortOrder: item.sortOrder ?? 0,
  }));

  const members: Member[] = groupMembers.map((m) => ({
    userId: m.userId,
    displayName: m.User?.displayName ?? "Unknown",
    avatarUrl: m.User?.profilePictureUrl ?? m.User?.avatarUrl ?? null,
  }));

  return (
    <GroupBillClient
      groupId={groupId}
      billId={billId}
      currentUserId={user.id}
      bill={{
        id: bill.id,
        name: bill.name,
        receiptType: bill.receiptType as "meal" | "other",
        status: bill.status as "in_progress" | "finalized",
        expenseId: bill.expenseId ?? null,
        receiptImageSignedUrl,
      }}
      initialItems={items}
      members={members}
    />
  );
}
