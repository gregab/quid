import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // For each group, compute the user's net balance
  const groupBalances: GroupBalance[] = [];

  for (const membership of memberships ?? []) {
    const group = membership.Group!;

    // Compute net balance: sum of what user paid - sum of user's splits
    const { data: expenses } = await supabase
      .from("Expense")
      .select("amountCents, paidById, ExpenseSplit(userId, amountCents)")
      .eq("groupId", group.id);

    let balanceCents = 0;
    for (const expense of expenses ?? []) {
      if (expense.paidById === user.id) {
        balanceCents += expense.amountCents;
      }
      for (const split of expense.ExpenseSplit ?? []) {
        if (split.userId === user.id) {
          balanceCents -= split.amountCents;
        }
      }
    }

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
