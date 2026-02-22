import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive("Amount must be greater than zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  paidById: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).min(1).optional(),
});

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

  const body: unknown = await request.json();
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { description, amountCents, date, paidById: rawPaidById, participantIds: rawParticipantIds } = parsed.data;

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

  // Detect what changed for the activity log
  const changes: {
    amount?: { from: number; to: number };
    date?: { from: string; to: string };
    description?: { from: string; to: string };
    paidBy?: { from: string; to: string };
    participants?: { added: string[]; removed: string[] };
  } = {};

  if (expense.amountCents !== amountCents) {
    changes.amount = { from: expense.amountCents, to: amountCents };
  }
  if (expense.description !== description) {
    changes.description = { from: expense.description, to: description };
  }
  // Supabase returns dates as ISO strings — extract YYYY-MM-DD
  const oldDateStr = expense.date.split("T")[0];
  if (oldDateStr !== date) {
    changes.date = { from: oldDateStr, to: date };
  }
  if (expense.paidById !== newPaidById) {
    changes.paidBy = { from: expense.User!.displayName, to: newPaidByMember.User!.displayName };
  }
  const oldParticipantIds = new Set((splits ?? []).map((s) => s.userId));
  const newParticipantIds = new Set(participants.map((m) => m.userId));
  const addedParticipants = participants
    .filter((m) => !oldParticipantIds.has(m.userId))
    .map((m) => m.User!.displayName);
  const removedParticipants = (splits ?? [])
    .filter((s) => !newParticipantIds.has(s.userId))
    .map((s) => s.User!.displayName);
  if (addedParticipants.length > 0 || removedParticipants.length > 0) {
    changes.participants = { added: addedParticipants, removed: removedParticipants };
  }

  const participantIds = participants.map((m) => m.userId);

  const { error } = await supabase.rpc("update_expense", {
    _expense_id: expenseId,
    _group_id: groupId,
    _description: description,
    _amount_cents: amountCents,
    _date: date,
    _paid_by_id: newPaidById,
    _participant_ids: participantIds,
    _paid_by_display_name: newPaidByMember.User!.displayName,
    _changes: changes,
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
    .select("*, User!paidById(displayName)")
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

  const { error } = await supabase.rpc("delete_expense", {
    _expense_id: expenseId,
    _group_id: groupId,
    _description: expense.description,
    _amount_cents: expense.amountCents,
    _paid_by_display_name: expense.User!.displayName,
  });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: null, error: null });
}
