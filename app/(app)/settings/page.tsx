import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";
import { SettingsClient } from "./SettingsClient";

interface GroupBalance {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch groups the user is a member of
  const { data: memberships } = await supabase
    .from("GroupMember")
    .select("groupId, Group(id, name)")
    .eq("userId", user.id);

  const groupIds = (memberships ?? []).map((m) => m.groupId);

  // Fetch all expenses for all groups in one query (vs. N per-group queries)
  const { data: allExpenses } =
    groupIds.length > 0
      ? await supabase
          .from("Expense")
          .select("groupId, paidById, ExpenseSplit(userId, amountCents)")
          .in("groupId", groupIds)
      : { data: null };

  // Group expenses by groupId for O(1) lookup
  const expensesByGroup = new Map<string, NonNullable<typeof allExpenses>>();
  for (const expense of allExpenses ?? []) {
    const list = expensesByGroup.get(expense.groupId) ?? [];
    list.push(expense);
    expensesByGroup.set(expense.groupId, list);
  }

  // Compute balances in memory — no more per-group round trips
  const groupBalances: GroupBalance[] = [];

  for (const membership of memberships ?? []) {
    const group = membership.Group!;
    const expenses = expensesByGroup.get(group.id) ?? [];

    const expensesForDebt = expenses.map((e) => ({
      paidById: e.paidById,
      splits: (e.ExpenseSplit ?? []).map((s) => ({
        userId: s.userId,
        amountCents: s.amountCents,
      })),
    }));

    const balanceCents = getUserBalanceCents(expensesForDebt, user.id);

    if (balanceCents !== 0) {
      groupBalances.push({
        groupId: group.id,
        groupName: group.name,
        balanceCents,
      });
    }
  }

  const email = user.email ?? "";

  return <SettingsClient email={email} groupBalances={groupBalances} />;
}
