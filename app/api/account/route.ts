import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: memberships } = await supabase
    .from("GroupMember")
    .select("groupId, Group(id, name)")
    .eq("userId", user.id);

  const groupIds = (memberships ?? []).map((m) => m.groupId);

  const { data: allExpenses } =
    groupIds.length > 0
      ? await supabase
          .from("Expense")
          .select("groupId, paidById, ExpenseSplit(userId, amountCents)")
          .in("groupId", groupIds)
      : { data: null };

  const expensesByGroup = new Map<string, NonNullable<typeof allExpenses>>();
  for (const expense of allExpenses ?? []) {
    const list = expensesByGroup.get(expense.groupId) ?? [];
    list.push(expense);
    expensesByGroup.set(expense.groupId, list);
  }

  const groupBalances: { groupId: string; groupName: string; balanceCents: number }[] = [];

  for (const membership of memberships ?? []) {
    const group = membership.Group!;
    const expenses = expensesByGroup.get(group.id) ?? [];

    const balanceCents = getUserBalanceCents(
      expenses.map((e) => ({
        paidById: e.paidById,
        splits: (e.ExpenseSplit ?? []).map((s) => ({
          userId: s.userId,
          amountCents: s.amountCents,
        })),
      })),
      user.id
    );

    if (balanceCents !== 0) {
      groupBalances.push({ groupId: group.id, groupName: group.name, balanceCents });
    }
  }

  return NextResponse.json({ data: { groupBalances }, error: null });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  // 1. Clean up all app data (leave groups, delete User row)
  const { error: rpcError } = await supabase.rpc("delete_account");

  if (rpcError) {
    return NextResponse.json({ data: null, error: rpcError.message }, { status: 500 });
  }

  // 2. Delete the auth user via admin client
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json({ data: null, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true }, error: null });
}
