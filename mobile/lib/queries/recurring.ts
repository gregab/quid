import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";

export interface RecurringExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  frequency: "weekly" | "monthly" | "yearly";
  nextDueDate: string;
  paidByDisplayName: string;
  isActive: boolean;
}

/** Fetch active recurring expenses for a group. */
export function useRecurringExpenses(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: groupKeys.recurringExpenses(groupId),
    enabled: !!groupId && !!user,
    queryFn: async (): Promise<RecurringExpenseRow[]> => {
      const { data, error } = await supabase
        .from("RecurringExpense")
        .select("id, description, amountCents, frequency, nextDueDate, isActive, User!RecurringExpense_paidById_fkey(displayName)")
        .eq("groupId", groupId)
        .eq("isActive", true)
        .order("nextDueDate", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => {
        const payer = row.User as Record<string, unknown> | null;
        return {
          id: row.id as string,
          description: row.description as string,
          amountCents: row.amountCents as number,
          frequency: row.frequency as "weekly" | "monthly" | "yearly",
          nextDueDate: (row.nextDueDate as string).split("T")[0]!,
          paidByDisplayName: (payer?.displayName as string) ?? "Unknown",
          isActive: row.isActive as boolean,
        };
      });
    },
  });
}

/** Stop a recurring expense (deactivates and deletes the template). */
export function useStopRecurringExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recurringExpenseId: string) => {
      const { error } = await supabase.rpc("stop_recurring_expense", {
        _recurring_id: recurringExpenseId,
      });
      if (error) throw error;
    },
    onMutate: async (recurringExpenseId: string) => {
      await queryClient.cancelQueries({
        queryKey: groupKeys.recurringExpenses(groupId),
      });

      const previous = queryClient.getQueryData<RecurringExpenseRow[]>(
        groupKeys.recurringExpenses(groupId),
      );

      queryClient.setQueryData<RecurringExpenseRow[]>(
        groupKeys.recurringExpenses(groupId),
        (old) => (old ?? []).filter((r) => r.id !== recurringExpenseId),
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          groupKeys.recurringExpenses(groupId),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.recurringExpenses(groupId),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.expenses(groupId),
      });
    },
  });
}
