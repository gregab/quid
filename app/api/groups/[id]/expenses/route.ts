import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive("Amount must be greater than zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
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

  const { description, amountCents, date } = parsed.data;

  // Compute equal splits, distributing remainder 1 cent at a time
  const memberCount = members.length;
  const baseAmount = Math.floor(amountCents / memberCount);
  const remainder = amountCents % memberCount;

  const splitData = members.map((member, i) => ({
    userId: member.userId,
    amountCents: baseAmount + (i < remainder ? 1 : 0),
  }));

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        groupId,
        paidById: user.id,
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
