import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";
import type { ExpenseRow, Member } from "../types";
import { UNKNOWN_USER } from "./shared";
import { buildCreatePaymentParams } from "@aviary/shared";

interface CreatePaymentInput {
  groupId: string;
  amountCents: number;
  date: string;
  paidById: string;
  recipientId: string;
  members: Member[];
  settledUp?: boolean;
}

/** Record a payment with optimistic update. */
export function useCreatePayment(groupId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const params = buildCreatePaymentParams({
        groupId: input.groupId,
        amountCents: input.amountCents,
        date: input.date,
        paidById: input.paidById,
        recipientId: input.recipientId,
        members: input.members,
        settledUp: input.settledUp,
      });
      const { data, error } = await supabase.rpc("create_payment", params);
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

      const fromName =
        input.members.find((m) => m.userId === input.paidById)?.displayName ??
        UNKNOWN_USER;

      const optimistic: ExpenseRow = {
        id: `pending-payment-${Date.now()}`,
        description: "Payment",
        amountCents: input.amountCents,
        date: input.date,
        paidById: input.paidById,
        paidByDisplayName: fromName,
        participantIds: [input.recipientId],
        splits: [{ userId: input.recipientId, amountCents: input.amountCents }],
        splitType: "equal",
        canEdit: false,
        canDelete: true,
        isPayment: true,
        settledUp: input.settledUp,
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
