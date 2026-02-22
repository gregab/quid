import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
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

  // Fetch expense with group, current members (needed to recompute splits), paidBy, and splits (needed to diff participants)
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: { select: { displayName: true } },
      splits: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      group: {
        include: {
          members: {
            include: { user: { select: { displayName: true } } },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
  });

  if (!expense || expense.groupId !== groupId) {
    return NextResponse.json({ data: null, error: "Expense not found" }, { status: 404 });
  }

  const isMember = expense.group.members.some((m) => m.userId === user.id);
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

  const allMembers = expense.group.members;
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

  // Recompute equal splits among participants, distributing remainder 1 cent at a time
  const participantCount = participants.length;
  const baseAmount = Math.floor(amountCents / participantCount);
  const remainder = amountCents % participantCount;

  const splitData = participants.map((member, i) => ({
    userId: member.userId,
    amountCents: baseAmount + (i < remainder ? 1 : 0),
  }));

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
  const oldDateStr = expense.date.toISOString().split("T")[0];
  if (oldDateStr !== date) {
    changes.date = { from: oldDateStr, to: date };
  }
  if (expense.paidById !== newPaidById) {
    changes.paidBy = { from: expense.paidBy.displayName, to: newPaidByMember.user.displayName };
  }
  const oldParticipantIds = new Set(expense.splits.map((s) => s.userId));
  const newParticipantIds = new Set(participants.map((m) => m.userId));
  const addedParticipants = participants
    .filter((m) => !oldParticipantIds.has(m.userId))
    .map((m) => m.user.displayName);
  const removedParticipants = expense.splits
    .filter((s) => !newParticipantIds.has(s.userId))
    .map((s) => s.user.displayName);
  if (addedParticipants.length > 0 || removedParticipants.length > 0) {
    changes.participants = { added: addedParticipants, removed: removedParticipants };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id: expenseId },
      data: { description, amountCents, date: new Date(date), paidById: newPaidById },
    });

    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.createMany({
      data: splitData.map((s) => ({
        expenseId,
        userId: s.userId,
        amountCents: s.amountCents,
      })),
    });

    await tx.activityLog.create({
      data: {
        groupId,
        actorId: user.id,
        action: "expense_edited",
        payload: {
          description,
          amountCents,
          paidByDisplayName: newPaidByMember.user.displayName,
          changes,
        },
      },
    });

    return result;
  });

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
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { paidBy: { select: { displayName: true } } },
  });

  if (!expense || expense.groupId !== groupId) {
    return NextResponse.json({ data: null, error: "Expense not found" }, { status: 404 });
  }

  // Verify user is a member of the group
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

  if (!membership) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        groupId,
        actorId: user.id,
        action: "expense_deleted",
        payload: {
          description: expense.description,
          amountCents: expense.amountCents,
          paidByDisplayName: expense.paidBy.displayName,
        },
      },
    });

    await tx.expense.delete({ where: { id: expenseId } });
  });

  return NextResponse.json({ data: null, error: null });
}
