import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { groupKeys } from "./keys";

/** Add a member to a group by email using the new RPC. */
export function useAddMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("add_member_by_email", {
        _group_id: groupId,
        _email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      return data as { userId: string; displayName: string; groupId: string; joinedAt: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(groupId),
      });
      void queryClient.invalidateQueries({
        queryKey: groupKeys.members(groupId),
      });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

/** Leave a group. */
export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("leave_group", {
        _group_id: groupId,
      });
      if (error) throw error;
      return data as { deleted_group: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
      // Remove this group's cached data
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.removeQueries({ queryKey: groupKeys.expenses(groupId) });
      queryClient.removeQueries({ queryKey: groupKeys.activity(groupId) });
    },
  });
}
