import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { simplifyDebts } from "@/lib/balances/simplify";

export async function GET(
  _request: NextRequest,
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

  // Verify the requesting user is a member
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const [members, expenses] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true },
    }),
    prisma.expense.findMany({
      where: { groupId },
      include: { splits: true },
    }),
  ]);

  const userMap = new Map(members.map((m) => [m.userId, m.user]));

  // Build raw debts: each split creates a debt from the split user to the payer
  const rawDebts = expenses.flatMap((expense) =>
    expense.splits
      .filter((split) => split.userId !== expense.paidById)
      .map((split) => ({
        from: split.userId,
        to: expense.paidById,
        amount: split.amountCents,
      }))
  );

  const simplified = simplifyDebts(rawDebts);

  const data = simplified.map((debt) => ({
    fromId: debt.from,
    fromName: userMap.get(debt.from)?.displayName ?? debt.from,
    toId: debt.to,
    toName: userMap.get(debt.to)?.displayName ?? debt.to,
    amountCents: debt.amount,
  }));

  return NextResponse.json({ data, error: null });
}
