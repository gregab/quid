import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";
import type { ExpenseRow, Member } from "../types";
import { UNKNOWN_USER, splitAmount } from "./shared";

interface CreateExpenseInput {
  groupId: string;
  description: string;
  amountCents: number;
  date: string;
  paidById: string;
  participantIds: string[];
  members: Member[];
  splitType: "equal" | "custom" | "percentage";
  splitAmounts?: number[];
  recurringFrequency?: "weekly" | "monthly" | "yearly";
}

/** Create a new expense with optimistic update. */
export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const paidByName =
        input.members.find((m) => m.userId === input.paidById)?.displayName ??
        UNKNOWN_USER;
      const participantNames = input.participantIds.map(
        (id) =>
          input.members.find((m) => m.userId === id)?.displayName ??
          UNKNOWN_USER,
      );

      if (input.recurringFrequency) {
        // Create recurring expense template + first instance
        const { data, error } = await supabase.rpc(
          "create_recurring_expense",
          {
            _group_id: input.groupId,
            _description: input.description,
            _amount_cents: input.amountCents,
            _paid_by_id: input.paidById,
            _participant_ids: input.participantIds,
            _split_type: input.splitType === "percentage" ? "custom" : input.splitType,
            _custom_splits: input.splitAmounts
              ? JSON.stringify(
                  input.participantIds.map((id, i) => ({
                    userId: id,
                    amountCents: input.splitAmounts![i],
                  })),
                )
              : null,
            _frequency: input.recurringFrequency,
            _first_date: input.date,
            _paid_by_display_name: paidByName,
            _participant_display_names: participantNames,
          },
        );
        if (error) throw error;
        return data as string;
      }

      const { data, error } = await supabase.rpc("create_expense", {
        _group_id: input.groupId,
        _description: input.description,
        _amount_cents: input.amountCents,
        _date: input.date,
        _paid_by_id: input.paidById,
        _participant_ids: input.participantIds,
        _paid_by_display_name: paidByName,
        _split_type: input.splitType === "percentage" ? "custom" : input.splitType,
        _split_amounts: input.splitAmounts ?? null,
        _participant_display_names: participantNames,
      });
      if (error) throw error;
      return data as string;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: groupKeys.expenses(groupId),
      });

      const previous = queryClient.getQueryData<ExpenseRow[]>(
        groupKeys.expenses(groupId),
      );

      const paidByName =
        input.members.find((m) => m.userId === input.paidById)?.displayName ??
        UNKNOWN_USER;

      // Compute splits for optimistic display
      const splits =
        input.splitAmounts
          ? input.participantIds.map((id, i) => ({
              userId: id,
              amountCents: input.splitAmounts![i]!,
            }))
          : splitAmount(input.amountCents, input.participantIds.length).map(
              (amt, i) => ({
                userId: input.participantIds[i]!,
                amountCents: amt,
              }),
            );

      const optimistic: ExpenseRow = {
        id: `pending-expense-${Date.now()}`,
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        paidById: input.paidById,
        paidByDisplayName: paidByName,
        participantIds: input.participantIds,
        splits,
        splitType: input.splitType === "percentage" ? "custom" : input.splitType,
        canEdit: true,
        canDelete: true,
        createdById: user?.id,
        isPending: true,
      };

      queryClient.setQueryData<ExpenseRow[]>(
        groupKeys.expenses(groupId),
        (old) => [optimistic, ...(old ?? [])],
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          groupKeys.expenses(groupId),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.expenses(groupId),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.activity(groupId),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

interface UpdateExpenseInput {
  expenseId: string;
  description: string;
  amountCents: number;
  date: string;
  paidById: string;
  participantIds: string[];
  members: Member[];
  splitType: "equal" | "custom" | "percentage";
  splitAmounts?: number[];
  changes: Record<string, unknown>;
  beforeSplits: Array<{ displayName: string; amountCents: number }>;
  afterSplits: Array<{ displayName: string; amountCents: number }>;
}

/** Update an existing expense. */
export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateExpenseInput) => {
      const paidByName =
        input.members.find((m) => m.userId === input.paidById)?.displayName ??
        UNKNOWN_USER;
      const participantNames = input.participantIds.map(
        (id) =>
          input.members.find((m) => m.userId === id)?.displayName ??
          UNKNOWN_USER,
      );

      const { error } = await supabase.rpc("update_expense", {
        _expense_id: input.expenseId,
        _description: input.description,
        _amount_cents: input.amountCents,
        _date: input.date,
        _paid_by_id: input.paidById,
        _participant_ids: input.participantIds,
        _paid_by_display_name: paidByName,
        _split_type: input.splitType === "percentage" ? "custom" : input.splitType,
        _split_amounts: input.splitAmounts ?? null,
        _participant_display_names: participantNames,
        _changes: JSON.stringify(input.changes),
        _before_splits: JSON.stringify(input.beforeSplits),
        _after_splits: JSON.stringify(input.afterSplits),
      });
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.expenses(groupId),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.activity(groupId),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

/** Delete an expense with optimistic removal. */
export function useDeleteExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      description,
      amountCents,
      participantDisplayNames,
      isPayment,
    }: {
      expenseId: string;
      description: string;
      amountCents: number;
      participantDisplayNames: string[];
      isPayment: boolean;
    }) => {
      const { error } = await supabase.rpc("delete_expense", {
        _expense_id: expenseId,
        _description: description,
        _amount_cents: amountCents,
        _participant_display_names: participantDisplayNames,
        _is_payment: isPayment,
      });
      if (error) throw error;
    },
    onMutate: async ({ expenseId }) => {
      await queryClient.cancelQueries({
        queryKey: groupKeys.expenses(groupId),
      });

      const previous = queryClient.getQueryData<ExpenseRow[]>(
        groupKeys.expenses(groupId),
      );

      queryClient.setQueryData<ExpenseRow[]>(
        groupKeys.expenses(groupId),
        (old) => (old ?? []).filter((e) => e.id !== expenseId),
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          groupKeys.expenses(groupId),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.expenses(groupId),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.activity(groupId),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}
