import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateExpenseSchema, computeExpenseChanges } from "@aviary/shared";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, expenseId } = await params;

  // Fetch expense with paidBy user
  const { data: expense } = await supabase
    .from("Expense")
    .select("*, User!paidById(displayName)")
    .eq("id", expenseId)
    .single();

  if (!expense || expense.groupId !== groupId) {
    return NextResponse.json({ data: null, error: "Expense not found" }, { status: 404 });
  }

  // Fetch splits with user display names
  const { data: splits } = await supabase
    .from("ExpenseSplit")
    .select("userId, amountCents, User(id, displayName)")
    .eq("expenseId", expenseId);

  // Fetch group members
  const { data: allMembers } = await supabase
    .from("GroupMember")
    .select("userId, User(displayName)")
    .eq("groupId", groupId)
    .order("joinedAt", { ascending: true });

  if (!allMembers) {
    return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
  }

  const isMember = allMembers.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Only the creator can edit.
  if (expense.createdById !== user.id) {
    return NextResponse.json({ data: null, error: "Only the creator can edit this expense" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    description,
    amountCents,
    date,
    paidById: rawPaidById,
    participantIds: rawParticipantIds,
    splitType,
    customSplits,
  } = parsed.data;

  const memberIds = new Set(allMembers.map((m) => m.userId));

  const newPaidById = rawPaidById ?? expense.paidById;
  if (!memberIds.has(newPaidById)) {
    return NextResponse.json({ data: null, error: "Payer is not a member of this group" }, { status: 400 });
  }

  const newPaidByMember = allMembers.find((m) => m.userId === newPaidById)!;

  let participants = allMembers;
  if (rawParticipantIds) {
    const invalidIds = rawParticipantIds.filter((id) => !memberIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ data: null, error: "One or more participants are not group members" }, { status: 400 });
    }
    participants = allMembers.filter((m) => rawParticipantIds.includes(m.userId));
  }

  // Supabase returns dates as ISO strings — extract YYYY-MM-DD
  const oldDateStr = expense.date.split("T")[0];

  const participantIds = participants.map((m) => m.userId);
  const oldParticipantIds = (splits ?? []).map((s) => s.userId);

  // Build display name resolver from members + old splits
  const displayNameMap = new Map<string, string>();
  for (const m of allMembers) displayNameMap.set(m.userId, m.User!.displayName);
  for (const s of splits ?? []) {
    if (!displayNameMap.has(s.userId)) {
      displayNameMap.set(s.userId, (s.User as { id: string; displayName: string } | null)?.displayName ?? "Unknown");
    }
  }

  // Detect what changed for the activity log
  const changes = computeExpenseChanges(
    {
      amountCents: expense.amountCents,
      description: expense.description,
      date: oldDateStr,
      paidById: expense.paidById,
      paidByDisplayName: expense.User!.displayName,
      splitType: expense.splitType,
    },
    {
      amountCents,
      description,
      date,
      paidById: newPaidById,
      paidByDisplayName: newPaidByMember.User!.displayName,
      splitType: splitType ?? "equal",
    },
    oldParticipantIds,
    participantIds,
    (id) => displayNameMap.get(id) ?? "Unknown",
  );

  // Validate custom splits
  let splitAmounts: number[] | null = null;
  const effectiveSplitType = splitType ?? "equal";

  if (effectiveSplitType === "custom") {
    if (!customSplits || customSplits.length === 0) {
      return NextResponse.json({ data: null, error: "Custom split amounts are required when splitType is 'custom'" }, { status: 400 });
    }
    const participantSet = new Set(participantIds);
    for (const s of customSplits) {
      if (!participantSet.has(s.userId)) {
        return NextResponse.json({ data: null, error: "Custom split includes a userId that is not a participant" }, { status: 400 });
      }
    }
    const sum = customSplits.reduce((acc, s) => acc + s.amountCents, 0);
    if (sum !== amountCents) {
      return NextResponse.json(
        { data: null, error: `Custom split amounts must sum to the total (expected ${amountCents}, got ${sum})` },
        { status: 400 }
      );
    }
    splitAmounts = participantIds.map((id) => {
      const s = customSplits.find((cs) => cs.userId === id);
      return s?.amountCents ?? 0;
    });
  }

  // Build splitsBefore snapshot from existing splits
  const splitsBefore = (splits ?? []).map((s) => ({
    displayName: (s.User as { id: string; displayName: string } | null)?.displayName ?? "Unknown",
    amountCents: s.amountCents,
  }));

  // Build splitsAfter snapshot
  let splitsAfter: { displayName: string; amountCents: number }[];
  if (effectiveSplitType === "custom" && splitAmounts) {
    splitsAfter = participants.map((m, i) => ({
      displayName: m.User!.displayName,
      amountCents: splitAmounts[i]!,
    }));
  } else {
    const n = participants.length;
    const base = Math.floor(amountCents / n);
    const remainder = amountCents % n;
    splitsAfter = participants.map((m, i) => ({
      displayName: m.User!.displayName,
      amountCents: base + (i < remainder ? 1 : 0),
    }));
  }

  const { error } = await supabase.rpc("update_expense", {
    _expense_id: expenseId,
    _group_id: groupId,
    _description: description,
    _amount_cents: amountCents,
    _date: date,
    _paid_by_id: newPaidById,
    _participant_ids: participantIds,
    _paid_by_display_name: newPaidByMember.User!.displayName,
    _changes: JSON.parse(JSON.stringify(changes)),
    _split_type: effectiveSplitType,
    _split_amounts: splitAmounts ?? undefined,
    _splits_before: splitsBefore,
    _splits_after: splitsAfter,
  });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  // Fetch the updated expense to return it
  const { data: updated } = await supabase
    .from("Expense")
    .select("*")
    .eq("id", expenseId)
    .single();

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, expenseId } = await params;

  // Fetch expense with paidBy for activity log payload
  const { data: expense } = await supabase
    .from("Expense")
    .select("*, User!paidById(displayName), ExpenseSplit(userId, User(displayName))")
    .eq("id", expenseId)
    .single();

  if (!expense || expense.groupId !== groupId) {
    return NextResponse.json({ data: null, error: "Expense not found" }, { status: 404 });
  }

  // Verify user is a member of the group
  const { data: membership } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Only the creator can delete. Payments are enforced inside the RPC.
  if (!expense.isPayment && expense.createdById !== user.id) {
    return NextResponse.json({ data: null, error: "Only the creator can delete this expense" }, { status: 403 });
  }

  const participantDisplayNames = (expense.ExpenseSplit ?? []).map(
    (s) => (s.User as { displayName: string } | null)?.displayName ?? "Unknown"
  );

  const { error } = await supabase.rpc("delete_expense", {
    _expense_id: expenseId,
    _group_id: groupId,
    _description: expense.description,
    _amount_cents: expense.amountCents,
    _paid_by_display_name: expense.User!.displayName,
    _date: expense.date.split("T")[0],
    _participant_display_names: expense.isPayment ? undefined : participantDisplayNames,
  });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: null, error: null });
}
