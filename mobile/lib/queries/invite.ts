import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { inviteKeys, groupKeys } from "./keys";

interface InvitePreview {
  id: string;
  name: string;
  memberCount: number;
  isMember: boolean;
}

/** Fetch invite preview by token. */
export function useInvitePreview(token: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: inviteKeys.preview(token),
    enabled: !!token && !!user,
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await supabase.rpc("get_group_by_invite_token", {
        _token: token,
      });
      if (error) throw error;
      if (!data) throw new Error("Invalid invite link");

      const result = data as Record<string, unknown>;
      return {
        id: result.id as string,
        name: result.name as string,
        memberCount: result.member_count as number,
        isMember: result.is_member as boolean,
      };
    },
  });
}

/** Join a group via invite token. */
export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("join_group_by_token", {
        _token: token,
      });
      if (error) throw error;
      return data as { groupId: string; alreadyMember: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}
