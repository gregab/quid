import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import type { Contact } from "../types";

export const contactKeys = {
  all: ["contacts"] as const,
};

/** Fetch all unique users across regular (non-friend) groups, excluding self. */
export function useContacts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: contactKeys.all,
    enabled: !!user,
    queryFn: async (): Promise<Contact[]> => {
      if (!user) throw new Error("Not authenticated");

      // Fetch all groups the user belongs to
      const { data: memberships, error: memberError } = await supabase
        .from("GroupMember")
        .select("Group(id, isFriendGroup)")
        .eq("userId", user.id);

      if (memberError) throw memberError;

      // Get only regular group IDs
      const regularGroupIds = (memberships ?? [])
        .map((m) => (m as unknown as { Group: Record<string, unknown> }).Group)
        .filter((g) => g && !g.isFriendGroup)
        .map((g) => g.id as string);

      if (regularGroupIds.length === 0) return [];

      // Fetch all members of regular groups with user data
      const { data: allMembers, error: contactError } = await supabase
        .from("GroupMember")
        .select("userId, User(displayName, avatarUrl, profilePictureUrl)")
        .in("groupId", regularGroupIds);

      if (contactError) throw contactError;

      // Deduplicate, excluding self
      const seen = new Set<string>();
      const contacts: Contact[] = [];
      for (const m of allMembers ?? []) {
        if (m.userId === user.id || seen.has(m.userId)) continue;
        seen.add(m.userId);
        const u = m.User as unknown as Record<string, unknown> | null;
        if (u) {
          contacts.push({
            userId: m.userId,
            displayName: (u.displayName as string) ?? "Unknown",
            avatarUrl: (u.profilePictureUrl as string) ?? (u.avatarUrl as string) ?? null,
          });
        }
      }

      contacts.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return contacts;
    },
  });
}
