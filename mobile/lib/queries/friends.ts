import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { groupKeys } from "./keys";
import { contactKeys } from "./contacts";
import { splitAmount, buildCreateExpenseParams } from "@aviary/shared";

interface CreateFriendExpenseInput {
  friendIds: string[];
  description: string;
  amountCents: number;
  date: string;
  paidById?: string;
}

interface MemberLike {
  userId: string;
  displayName: string;
}

/** Create an expense split across one or more friends (creates/finds friend groups as needed). */
export function useCreateFriendExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFriendExpenseInput) => {
      if (!user) throw new Error("Not authenticated");

      const { friendIds, description, amountCents, date, paidById: rawPaidById } = input;
      const paidById = rawPaidById ?? user.id;

      // Compute per-person shares
      const totalParticipants = friendIds.length + 1;
      const shares = splitAmount(amountCents, totalParticipants);

      // Fetch current user's display name
      const { data: currentProfile } = await supabase
        .from("User")
        .select("displayName")
        .eq("id", user.id)
        .single();
      const currentUserDisplayName = currentProfile?.displayName ?? "Unknown";

      const friendGroupIds: string[] = [];

      for (let i = 0; i < friendIds.length; i++) {
        const friendId = friendIds[i]!;
        const friendShare = shares[i + 1]!;

        // Get or create friend group
        const { data: groupId, error: groupError } = await supabase.rpc(
          "get_or_create_friend_group",
          { _other_user_id: friendId },
        );

        if (groupError || !groupId) {
          throw new Error(groupError?.message ?? "Failed to get/create friend group");
        }

        friendGroupIds.push(groupId as string);

        // Fetch friend's display name
        const { data: friendProfile } = await supabase
          .from("User")
          .select("displayName")
          .eq("id", friendId)
          .single();
        const friendDisplayName = friendProfile?.displayName ?? "Unknown";

        const myShare = amountCents - friendShare;
        const participantIds = [user.id, friendId];
        const splitAmounts = [myShare, friendShare];

        const members: MemberLike[] = [
          { userId: user.id, displayName: currentUserDisplayName },
          { userId: friendId, displayName: friendDisplayName },
        ];

        const params = buildCreateExpenseParams({
          groupId: groupId as string,
          description,
          amountCents,
          date,
          paidById,
          participantIds,
          members,
          splitType: "custom",
          splitAmounts,
          participantDisplayNames: [currentUserDisplayName, friendDisplayName],
        });

        const { error: expenseError } = await supabase.rpc("create_expense", params);
        if (expenseError) {
          throw new Error(expenseError.message);
        }
      }

      return { createdCount: friendIds.length, friendGroupIds };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}
