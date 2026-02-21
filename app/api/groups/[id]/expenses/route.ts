import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
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

  // Verify the requesting user is a member of the group
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
  });

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

  const participants = rawParticipantIds
    ? members.filter((m) => rawParticipantIds.includes(m.userId))
    : members;

  if (rawParticipantIds) {
    const invalidIds = rawParticipantIds.filter((id) => !memberIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ data: null, error: "One or more participants are not group members" }, { status: 400 });
    }
  }

  // Compute equal splits among participants, distributing remainder 1 cent at a time
  const participantCount = participants.length;
  const baseAmount = Math.floor(amountCents / participantCount);
  const remainder = amountCents % participantCount;

  const splitData = participants.map((member, i) => ({
    userId: member.userId,
    amountCents: baseAmount + (i < remainder ? 1 : 0),
  }));

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        groupId,
        paidById,
        description,
        amountCents,
        date: new Date(date),
      },
    });

    await tx.expenseSplit.createMany({
      data: splitData.map((s) => ({
        expenseId: created.id,
        userId: s.userId,
        amountCents: s.amountCents,
      })),
    });

    return created;
  });

  return NextResponse.json({ data: expense, error: null }, { status: 201 });
}
