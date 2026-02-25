import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { userKeys } from "./keys";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  profilePictureUrl: string | null;
  defaultEmoji: string | null;
}

/** Fetch the current user's profile from the User table. */
export function useCurrentUser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: userKeys.profile,
    enabled: !!user,
    queryFn: async (): Promise<UserProfile> => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("User")
        .select("id, email, displayName, avatarUrl, profilePictureUrl, defaultEmoji")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
  });
}

/** Update the current user's display name. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ displayName }: { displayName: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("User")
        .update({ displayName })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.profile });
    },
  });
}

/** Delete the current user's account. */
export function useDeleteAccount() {
  const { signOut } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
    },
    onSuccess: async () => {
      await signOut();
    },
  });
}
