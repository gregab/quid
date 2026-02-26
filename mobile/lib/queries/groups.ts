import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";
import type { GroupSummary, ExpenseRow, Member } from "../types";
import {
  getUserBalanceCents,
  buildRawDebts,
  simplifyDebts,
  formatDisplayName,
  formatCents,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
} from "./shared";

/** Fetch all groups the current user is a member of, with balance per group. */
export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: groupKeys.all,
    enabled: !!user,
    queryFn: async (): Promise<GroupSummary[]> => {
      if (!user) throw new Error("Not authenticated");

      // Fetch groups with member count
      const { data: memberships, error: memberError } = await supabase
        .from("GroupMember")
        .select("Group(*)")
        .eq("userId", user.id)
        .order("joinedAt", { ascending: false });

      if (memberError) throw memberError;

      const groups = (memberships ?? [])
        .map((m) => (m as unknown as { Group: Record<string, unknown> }).Group)
        .filter(Boolean);

      if (groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id as string);

      // Fetch member counts
      const { data: allMembers } = await supabase
        .from("GroupMember")
        .select("groupId")
        .in("groupId", groupIds);

      const memberCounts = new Map<string, number>();
      for (const m of allMembers ?? []) {
        memberCounts.set(
          m.groupId,
          (memberCounts.get(m.groupId) ?? 0) + 1,
        );
      }

      // Fetch expenses for balance computation
      const { data: expenses } = await supabase
        .from("Expense")
        .select("paidById, groupId, ExpenseSplit(userId, amountCents)")
        .in("groupId", groupIds);

      // Group expenses by groupId
      const expensesByGroup = new Map<
        string,
        Array<{ paidById: string; splits: Array<{ userId: string; amountCents: number }> }>
      >();
      for (const exp of expenses ?? []) {
        const gid = exp.groupId as string;
        if (!expensesByGroup.has(gid)) expensesByGroup.set(gid, []);
        expensesByGroup.get(gid)!.push({
          paidById: exp.paidById,
          splits: (exp.ExpenseSplit ?? []).map((s: { userId: string; amountCents: number }) => ({
            userId: s.userId,
            amountCents: s.amountCents,
          })),
        });
      }

      return groups.map((g) => ({
        id: g.id as string,
        name: g.name as string,
        createdAt: g.createdAt as string,
        patternSeed: (g.patternSeed as string) ?? null,
        bannerUrl: (g.bannerUrl as string) ?? null,
        emoji: (g.emoji as string) ?? null,
        memberCount: memberCounts.get(g.id as string) ?? 1,
        balanceCents: getUserBalanceCents(
          expensesByGroup.get(g.id as string) ?? [],
          user.id,
        ),
        isFriendGroup: (g.isFriendGroup as boolean) ?? false,
      }));
    },
  });
}

/** Fetch full group detail including members. */
export function useGroupDetail(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: groupKeys.detail(groupId),
    enabled: !!groupId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Group")
        .select("*, GroupMember(*, User(*))")
        .eq("id", groupId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/** Fetch expenses for a group with splits and payer info. */
export function useGroupExpenses(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: groupKeys.expenses(groupId),
    enabled: !!groupId && !!user,
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from("Expense")
        .select(
          "*, User!Expense_paidById_fkey(*), ExpenseSplit(*, User(displayName)), RecurringExpense(id, frequency)",
        )
        .eq("groupId", groupId)
        .order("date", { ascending: false })
        .order("createdAt", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((expense: Record<string, unknown>) => {
        const payer = expense.User as Record<string, unknown> | null;
        const splits = (
          (expense.ExpenseSplit as Array<Record<string, unknown>>) ?? []
        ).map((s) => ({
          userId: s.userId as string,
          amountCents: s.amountCents as number,
        }));

        return {
          id: expense.id as string,
          description: expense.description as string,
          amountCents: expense.amountCents as number,
          date: (expense.date as string).split("T")[0]!,
          paidById: expense.paidById as string,
          paidByDisplayName:
            (payer?.displayName as string) ?? UNKNOWN_USER,
          participantIds: splits.map((s) => s.userId),
          splits,
          splitType: (expense.splitType as "equal" | "custom") ?? "equal",
          canEdit:
            !expense.isPayment &&
            !expense.recurringExpenseId &&
            expense.createdById === user?.id,
          canDelete: expense.createdById === user?.id,
          isPayment: (expense.isPayment as boolean) ?? false,
          settledUp: (expense.settledUp as boolean) ?? false,
          createdById: expense.createdById as string,
          createdAt: expense.createdAt as string,
          updatedAt: (expense.updatedAt as string) ?? null,
          recurringExpense: expense.RecurringExpense
            ? {
                id: (expense.RecurringExpense as Record<string, unknown>)
                  .id as string,
                frequency: (
                  expense.RecurringExpense as Record<string, unknown>
                ).frequency as "weekly" | "monthly" | "yearly",
              }
            : null,
        };
      });
    },
  });
}

/** Create a new group. */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc("create_group", {
        _name: name,
      });
      if (error) throw error;
      return data as string; // returns group ID
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}
