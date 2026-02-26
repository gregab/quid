import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFriendExpenseSchema } from "@aviary/shared";
import { splitAmount } from "@/lib/balances/splitAmount";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = createFriendExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const {
    friendIds,
    description,
    amountCents,
    date,
    paidById: rawPaidById,
    splitType: rawSplitType,
    customSplits,
  } = parsed.data;

  // Validate paidById: must be current user or a selected friend
  const paidById = rawPaidById ?? user.id;
  if (paidById !== user.id && !friendIds.includes(paidById)) {
    return NextResponse.json(
      { data: null, error: "Invalid payer — must be you or a selected friend" },
      { status: 400 },
    );
  }

  // Cannot add yourself as a friend
  if (friendIds.includes(user.id)) {
    return NextResponse.json(
      { data: null, error: "Cannot add an expense with yourself" },
      { status: 400 },
    );
  }

  // Build a per-user split map from customSplits or equal split
  const allParticipantIds = [user.id, ...friendIds];
  const splitMap = new Map<string, number>();

  if (rawSplitType === "custom" && customSplits) {
    // Validate custom splits sum to amountCents
    const sum = customSplits.reduce((s, cs) => s + cs.amountCents, 0);
    if (sum !== amountCents) {
      return NextResponse.json(
        { data: null, error: `Custom splits must sum to ${amountCents} cents, got ${sum}` },
        { status: 400 },
      );
    }
    for (const cs of customSplits) {
      splitMap.set(cs.userId, cs.amountCents);
    }
  } else {
    // Equal split among all participants
    const shares = splitAmount(amountCents, allParticipantIds.length);
    allParticipantIds.forEach((id, i) => splitMap.set(id, shares[i]!));
  }

  // Fetch current user's display name for activity log
  const { data: currentUserProfile } = await supabase
    .from("User")
    .select("displayName")
    .eq("id", user.id)
    .single();
  const currentUserDisplayName = currentUserProfile?.displayName ?? "Unknown";

  const friendGroupIds: string[] = [];

  for (const friendId of friendIds) {
    const myShare = splitMap.get(user.id) ?? 0;
    const friendShare = splitMap.get(friendId) ?? 0;

    // Get or create the friend group
    const { data: groupId, error: groupError } = await supabase.rpc(
      "get_or_create_friend_group",
      { _other_user_id: friendId },
    );

    if (groupError || !groupId) {
      return NextResponse.json(
        { data: null, error: groupError?.message ?? "Failed to get/create friend group" },
        { status: 500 },
      );
    }

    friendGroupIds.push(groupId as string);

    // Fetch friend's display name for activity log
    const { data: friendProfile } = await supabase
      .from("User")
      .select("displayName")
      .eq("id", friendId)
      .single();
    const friendDisplayName = friendProfile?.displayName ?? "Unknown";

    const participantIds = [user.id, friendId];
    const splitAmounts = [myShare, friendShare];
    const participantDisplayNames = [currentUserDisplayName, friendDisplayName];

    const paidByDisplayName = paidById === user.id ? currentUserDisplayName : friendDisplayName;

    const { error: expenseError } = await supabase.rpc("create_expense", {
      _group_id: groupId as string,
      _description: description,
      _amount_cents: amountCents,
      _date: date,
      _paid_by_id: paidById,
      _participant_ids: participantIds,
      _paid_by_display_name: paidByDisplayName,
      _split_type: "custom",
      _split_amounts: splitAmounts,
      _participant_display_names: participantDisplayNames,
    });

    if (expenseError) {
      return NextResponse.json(
        { data: null, error: expenseError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    data: { createdCount: friendIds.length, friendGroupIds },
    error: null,
  });
}
