import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";

// Deterministic emoji per group so it doesn't flicker
function groupEmoji(id: string): string {
  const emojis = ["🍕", "🏖️", "🏡", "🎉", "✈️", "🎮", "🍺", "🏔️", "🎸", "🚗", "🌮", "🎲", "🎭", "🏄", "🧳"];
  const index = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % emojis.length;
  return emojis[index];
}

const STATUS_MESSAGES = [
  "Reticulate expenses.",
  "Propagate debt through the social graph.",
  "Triangulate who ordered the appetizer.",
  "Amortize friendship overhead.",
  "Defragment the group ledger.",
  "Assert fairness across all known dimensions.",
  "Garbage collect unresolved tabs.",
  "Enumerate the appetizer claimants.",
  "Deprecate the spreadsheet.",
  "Distribute remainder cents.",
  "Collapse the superposition of who paid.",
  "Solve for the path of least resentment.",
  "Compute the moral hazard index.",
  "Reduce the guilt surface area.",
  "Traverse the expense graph depth-first.",
  "Invert the obligation matrix.",
  "Prune the liability tree.",
  "Find the eigenvector of who owes what.",
  "Decompose the guilt tensor.",
  "Integrate generosity over time.",
  "Project expenses onto the accountability plane.",
  "Approximate the equilibrium.",
  "Align incentives across the friendship graph.",
  "Normalize the asymmetric gratitude field.",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch groups the user is a member of, with the Group relation
  const { data: memberships } = await supabase
    .from("GroupMember")
    .select("*, Group(*)")
    .eq("userId", user.id);

  // Sort by group createdAt descending (Supabase doesn't support ordering by joined relation)
  const groups = (memberships ?? [])
    .map((m) => m.Group!)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

  const statusMessage = STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)]!;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 sm:p-8 text-white shadow-xl">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -right-6 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-violet-300/10 blur-2xl" />

        <div className="relative z-10">
          <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">🤝</div>
          <h1 className="mb-2 sm:mb-3 text-2xl sm:text-3xl font-black tracking-tight">
            Hey {displayName}.
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/80 font-mono">{statusMessage}</p>
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your groups</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {groups.length === 0
                ? "None yet — you're either incredibly generous or very new here."
                : groups.length === 1
                ? "1 circle of trust (financially speaking)"
                : `${groups.length} circles of trust (financially speaking)`}
            </p>
          </div>
          <CreateGroupButton userId={user.id} />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-5 py-12 sm:px-6 sm:py-20 text-center dark:border-gray-600 dark:bg-gray-800/50">
            <div className="mb-3 sm:mb-4 text-5xl sm:text-6xl">🫰</div>
            <p className="mb-2 text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300">No groups yet</p>
            <p className="mx-auto max-w-sm text-sm sm:text-base text-gray-500 dark:text-gray-400">
              Are you just picking up every tab like some kind of benevolent monarch?
              Chaotic good. Or maybe just create a group.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-500"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-2xl shadow-inner dark:from-indigo-900 dark:to-violet-800">
                  {groupEmoji(group.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">{group.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    since{" "}
                    {new Date(group.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <svg
                  className="h-4 w-4 flex-shrink-0 text-gray-300 transition-colors group-hover:text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer quip — only when there are groups */}
      {groups.length > 0 && (
        <p className="pb-2 text-center text-xs italic text-gray-400 dark:text-gray-500">
          Maybe the real financial independence is the friends we meticulously tracked along the way. 💸
        </p>
      )}
    </div>
  );
}
