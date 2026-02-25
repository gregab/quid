import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";
import type { ExpenseRow, Member } from "../types";
import { UNKNOWN_USER, splitAmount } from "./shared";
import {
  buildCreateExpenseParams,
  buildCreateRecurringExpenseParams,
  buildUpdateExpenseParams,
  buildDeleteExpenseParams,
  type ExpenseChanges,
} from "@aviary/shared";

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

      const normalizedSplitType =
        input.splitType === "percentage" ? "custom" : input.splitType;

      if (input.recurringFrequency) {
        const params = buildCreateRecurringExpenseParams({
          groupId: input.groupId,
          description: input.description,
          amountCents: input.amountCents,
          date: input.date,
          paidById: input.paidById,
          participantIds: input.participantIds,
          members: input.members,
          splitType: normalizedSplitType,
          splitAmounts: input.splitAmounts ?? null,
          participantDisplayNames: participantNames,
          frequency: input.recurringFrequency,
        });
        const { data, error } = await supabase.rpc(
          "create_recurring_expense",
          params,
        );
        if (error) throw error;
        return data as string;
      }

      const params = buildCreateExpenseParams({
        groupId: input.groupId,
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        paidById: input.paidById,
        participantIds: input.participantIds,
        members: input.members,
        splitType: normalizedSplitType,
        splitAmounts: input.splitAmounts ?? null,
        participantDisplayNames: participantNames,
      });
      const { data, error } = await supabase.rpc("create_expense", params);
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
  groupId: string;
  description: string;
  amountCents: number;
  date: string;
  paidById: string;
  participantIds: string[];
  members: Member[];
  splitType: "equal" | "custom" | "percentage";
  splitAmounts?: number[];
  changes: ExpenseChanges;
  splitsBefore: Array<{ displayName: string; amountCents: number }>;
  splitsAfter: Array<{ displayName: string; amountCents: number }>;
}

/** Update an existing expense. */
export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateExpenseInput) => {
      const params = buildUpdateExpenseParams({
        expenseId: input.expenseId,
        groupId: input.groupId,
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        paidById: input.paidById,
        participantIds: input.participantIds,
        members: input.members,
        splitType: input.splitType === "percentage" ? "custom" : input.splitType,
        splitAmounts: input.splitAmounts ?? null,
        changes: input.changes,
        splitsBefore: input.splitsBefore,
        splitsAfter: input.splitsAfter,
      });
      const { error } = await supabase.rpc("update_expense", params);
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
      paidByDisplayName,
      date,
      participantDisplayNames,
    }: {
      expenseId: string;
      description: string;
      amountCents: number;
      paidByDisplayName: string;
      date: string;
      participantDisplayNames: string[];
    }) => {
      const params = buildDeleteExpenseParams({
        expenseId,
        groupId,
        description,
        amountCents,
        paidByDisplayName,
        date,
        participantDisplayNames,
      });
      const { error } = await supabase.rpc("delete_expense", params);
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
