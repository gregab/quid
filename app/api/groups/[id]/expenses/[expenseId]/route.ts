import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

const updateExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive("Amount must be greater than zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
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

  // Fetch expense with group and current members (needed to recompute splits)
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: { orderBy: { joinedAt: "asc" } },
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

  // Only the payer can edit
  if (expense.paidById !== user.id) {
    return NextResponse.json(
      { data: null, error: "Only the payer can edit this expense" },
      { status: 403 }
    );
  }

  const body: unknown = await request.json();
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { description, amountCents, date } = parsed.data;

  // Recompute equal splits among current members
  const members = expense.group.members;
  const memberCount = members.length;
  const baseAmount = Math.floor(amountCents / memberCount);
  const remainder = amountCents % memberCount;

  const splitData = members.map((member, i) => ({
    userId: member.userId,
    amountCents: baseAmount + (i < remainder ? 1 : 0),
  }));

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id: expenseId },
      data: { description, amountCents, date: new Date(date) },
    });

    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.createMany({
      data: splitData.map((s) => ({
        expenseId,
        userId: s.userId,
        amountCents: s.amountCents,
      })),
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

  // Fetch expense with group to check creator
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { group: true },
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

  // Only the payer or group creator can delete
  const canDelete = expense.paidById === user.id || expense.group.createdById === user.id;
  if (!canDelete) {
    return NextResponse.json(
      { data: null, error: "Only the payer or group creator can delete this expense" },
      { status: 403 }
    );
  }

  await prisma.expense.delete({ where: { id: expenseId } });

  return NextResponse.json({ data: null, error: null });
}
