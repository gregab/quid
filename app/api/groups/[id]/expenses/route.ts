import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive("Amount must be greater than zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  paidById: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).min(1).optional(),
});

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

  // Fetch group members (also verifies group exists)
  const { data: members } = await supabase
    .from("GroupMember")
    .select("userId, User(displayName)")
    .eq("groupId", groupId)
    .order("joinedAt", { ascending: true });

  if (!members || members.length === 0) {
    return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
  }

  const isMember = members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = createExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { description, amountCents, date, paidById: rawPaidById, participantIds: rawParticipantIds } = parsed.data;

  const memberIds = new Set(members.map((m) => m.userId));

  const paidById = rawPaidById ?? user.id;
  if (!memberIds.has(paidById)) {
    return NextResponse.json({ data: null, error: "Payer is not a member of this group" }, { status: 400 });
  }

  const paidByMember = members.find((m) => m.userId === paidById)!;

  const participants = rawParticipantIds
    ? members.filter((m) => rawParticipantIds.includes(m.userId))
    : members;

  if (rawParticipantIds) {
    const invalidIds = rawParticipantIds.filter((id) => !memberIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ data: null, error: "One or more participants are not group members" }, { status: 400 });
    }
  }

  const participantIds = participants.map((m) => m.userId);

  const { data: expenseId, error } = await supabase.rpc("create_expense", {
    _group_id: groupId,
    _description: description,
    _amount_cents: amountCents,
    _date: date,
    _paid_by_id: paidById,
    _participant_ids: participantIds,
    _paid_by_display_name: paidByMember.User!.displayName,
  });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  // Fetch the created expense to return it
  const { data: expense } = await supabase
    .from("Expense")
    .select("*")
    .eq("id", expenseId)
    .single();

  return NextResponse.json({ data: expense, error: null }, { status: 201 });
}
