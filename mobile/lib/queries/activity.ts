import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { groupKeys } from "./keys";
import type { ActivityLog } from "../types";

const INITIAL_PAGE_SIZE = 15;
const PAGE_SIZE = 15;

/** Infinite-scroll activity logs for a group. */
export function useActivityLogs(groupId: string) {
  return useInfiniteQuery({
    queryKey: groupKeys.activity(groupId),
    enabled: !!groupId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ActivityLog[]> => {
      const limit = pageParam ? PAGE_SIZE : INITIAL_PAGE_SIZE;

      let query = supabase
        .from("ActivityLog")
        .select("*, User!actorId(displayName)")
        .eq("groupId", groupId)
        .order("createdAt", { ascending: false })
        .limit(limit);

      if (pageParam) {
        query = query.lt("createdAt", pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((log: Record<string, unknown>) => {
        const actor = log.User as { displayName: string } | null;
        const rawCreatedAt = log.createdAt as string;
        // Supabase timestamps may lack timezone suffix — normalize
        const createdAt = /[Z+]/.test(rawCreatedAt.slice(-6))
          ? rawCreatedAt
          : rawCreatedAt + "Z";

        return {
          id: log.id as string,
          action: log.action as string,
          payload: log.payload,
          createdAt,
          actor: { displayName: actor?.displayName ?? "Unknown" },
        };
      });
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam): string | undefined => {
      const expectedSize = lastPageParam ? PAGE_SIZE : INITIAL_PAGE_SIZE;
      if (lastPage.length < expectedSize) return undefined;
      const last = lastPage[lastPage.length - 1];
      return last?.createdAt as string | undefined;
    },
  });
}
