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

  // For each group, compute the user's simplified net balance
  const groupBalances: GroupBalance[] = [];

  for (const membership of memberships ?? []) {
    const group = membership.Group!;

    const { data: expenses } = await supabase
      .from("Expense")
      .select("paidById, ExpenseSplit(userId, amountCents)")
      .eq("groupId", group.id);

    const expensesForDebt = (expenses ?? []).map((e) => ({
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
