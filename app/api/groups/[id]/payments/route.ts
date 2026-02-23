import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_AMOUNT_CENTS } from "@/lib/amount";

const createPaymentSchema = z.object({
  amountCents: z
    .number()
    .int()
    .positive("Amount must be greater than zero")
    .max(MAX_AMOUNT_CENTS, "Amount cannot exceed $1,000,000"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  paidById: z.string().uuid().optional(),
  recipientId: z.string().uuid(),
  settledUp: z.boolean().optional(),
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

  // Fetch group members (also verifies group exists and user is a member)
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
  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { amountCents, date, paidById: rawPaidById, recipientId, settledUp } = parsed.data;

  const memberIds = new Set(members.map((m) => m.userId));

  const paidById = rawPaidById ?? user.id;
  if (!memberIds.has(paidById)) {
    return NextResponse.json({ data: null, error: "Payer is not a member of this group" }, { status: 400 });
  }

  if (!memberIds.has(recipientId)) {
    return NextResponse.json({ data: null, error: "Recipient is not a member of this group" }, { status: 400 });
  }

  if (paidById === recipientId) {
    return NextResponse.json({ data: null, error: "Payer and recipient must be different" }, { status: 400 });
  }

  const fromMember = members.find((m) => m.userId === paidById)!;
  const toMember = members.find((m) => m.userId === recipientId)!;

  const { data: expenseId, error } = await supabase.rpc("create_payment", {
    _group_id: groupId,
    _amount_cents: amountCents,
    _date: date,
    _paid_by_id: paidById,
    _recipient_id: recipientId,
    _from_display_name: fromMember.User!.displayName,
    _to_display_name: toMember.User!.displayName,
    _settled_up: settledUp ?? false,
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
