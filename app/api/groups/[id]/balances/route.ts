import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRawDebts } from "@/lib/balances/buildRawDebts";
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
  const { data: isMember } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!isMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const [membersResult, expensesResult] = await Promise.all([
    supabase
      .from("GroupMember")
      .select("*, User(*)")
      .eq("groupId", groupId),
    supabase
      .from("Expense")
      .select("*, User!paidById(displayName), ExpenseSplit(*, User(displayName))")
      .eq("groupId", groupId),
  ]);

  const members = membersResult.data ?? [];
  const expenses = expensesResult.data ?? [];

  // Build name map from current members, then fill in payers and split participants
  // so departed/deleted users still resolve to their display name.
  const userMap = new Map<string, string>(
    members.map((m) => [m.userId, m.User!.displayName])
  );
  for (const expense of expenses) {
    if (expense.User) userMap.set(expense.paidById, expense.User.displayName);
    for (const split of expense.ExpenseSplit ?? []) {
      const name = (split as { User?: { displayName: string } | null }).User?.displayName;
      if (name) userMap.set(split.userId, name);
    }
  }

  const expensesForDebt = expenses.map((e) => ({
    paidById: e.paidById,
    splits: (e.ExpenseSplit ?? []).map((s) => ({
      userId: s.userId,
      amountCents: s.amountCents,
    })),
  }));

  const simplified = simplifyDebts(buildRawDebts(expensesForDebt));

  const data = simplified.map((debt) => ({
    fromId: debt.from,
    fromName: userMap.get(debt.from) ?? "Unknown",
    toId: debt.to,
    toName: userMap.get(debt.to) ?? "Unknown",
    amountCents: debt.amount,
  }));

  return NextResponse.json({ data, error: null });
}
