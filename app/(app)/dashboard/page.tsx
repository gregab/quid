import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";

const BIRD_FACTS = [
  "A group of owls is called a parliament.",
  "A group of penguins is called a colony.",
  "A group of finches is called a charm.",
  "A group of geese is called a gaggle.",
  "A group of hawks is called a kettle.",
  "A group of ravens is called an unkindness.",
  "A group of woodpeckers is called a descent.",
  "A group of herons is called a siege.",
  "A group of parrots is called a pandemonium.",
  "A group of pheasants is called a bouquet.",
  "A group of swans is called a wedge.",
  "A group of flamingos is called a flamboyance.",
  "A group of crows is called a murder. Wait — we said no murder.",
  "Arctic terns migrate 44,000 miles a year — the longest of any bird.",
  "Crows can recognize human faces and hold grudges for years.",
  "A woodpecker's tongue wraps around its skull to cushion its brain.",
  "Pigeons can do math at roughly the level of primates.",
  "Albatrosses can sleep while flying.",
  "The bar-tailed godwit flies 7,000 miles nonstop — no food, no rest.",
  "Chickadees grow new brain cells every autumn to remember where they hid seeds.",
  "A peregrine falcon can dive at over 240 mph.",
  "Hummingbirds are the only birds that can fly backwards.",
  "Owls can't move their eyeballs — they rotate their heads up to 270 degrees instead.",
  "Kiwis are the only birds with nostrils at the tip of their beak.",
  "A group of starlings is called a murmuration.",
  "A group of larks is called an exaltation.",
  "Lyrebirds can mimic chainsaws, car alarms, and camera shutters.",
  "Ostriches have the largest eyes of any land animal — bigger than their brains.",
  "A flamingo can only eat with its head upside down.",
  "Emperor penguins can hold their breath for over 20 minutes.",
  "Crows have been observed using tools, and even making tools from scratch.",
  "The Australian magpie can recognize and remember up to 100 human faces.",
  "Ravens can plan ahead, trading a less-preferred item now for a better one later.",
  "Some parrots name their chicks, and those names stick for life.",
  "The sword-billed hummingbird is the only bird with a bill longer than its body.",
  "Bald eagles build the largest nests of any bird — up to 13 feet deep and 8 feet wide.",
  "Puffins use sticks to scratch themselves — one of few birds to use tools.",
  "Clark's nutcrackers hide up to 98,000 seeds each fall and remember where most of them are.",
  "The common swift can stay airborne for 10 months straight without landing.",
  "Pelicans scoop up to 3 gallons of water in a single gulp.",
  "New Caledonian crows craft hook-shaped tools — something even chimps don't do.",
  "Some species of ducks sleep with one eye open, keeping half their brain awake.",
  "A robin can hear worms moving underground.",
  "Male bowerbirds build elaborate structures and decorate them to attract mates.",
  "The kakapo is the world's only flightless parrot — and it smells like honey.",
  "Superb fairy-wrens teach a secret password to their unhatched chicks to foil parasitic cuckoos.",
  "Migrating birds can see Earth's magnetic field thanks to proteins in their eyes.",
  "African grey parrots can understand the concept of zero — something young children struggle with.",
  "A group of goldfinches is called a charm. It's also just charming to watch them.",
];

// Curated palette of 12 distinct, vibrant color pairs (bg gradient + text accent).
// Each group gets a deterministic color based on its ID hash.
const GROUP_PALETTES = [
  { from: "#f97316", to: "#ea580c" }, // orange
  { from: "#8b5cf6", to: "#7c3aed" }, // violet
  { from: "#06b6d4", to: "#0891b2" }, // cyan
  { from: "#ec4899", to: "#db2777" }, // pink
  { from: "#10b981", to: "#059669" }, // emerald
  { from: "#f59e0b", to: "#d97706" }, // amber
  { from: "#6366f1", to: "#4f46e5" }, // indigo
  { from: "#ef4444", to: "#dc2626" }, // red
  { from: "#14b8a6", to: "#0d9488" }, // teal
  { from: "#a855f7", to: "#9333ea" }, // purple
  { from: "#3b82f6", to: "#2563eb" }, // blue
  { from: "#84cc16", to: "#65a30d" }, // lime
];

function hashGroupId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getGroupPalette(id: string) {
  return GROUP_PALETTES[hashGroupId(id) % GROUP_PALETTES.length]!;
}

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

  // Fetch member counts per group
  const memberCountMap = new Map<string, number>();
  if (groups.length > 0) {
    const { data: allMembers } = await supabase
      .from("GroupMember")
      .select("groupId")
      .in("groupId", groups.map((g) => g.id));
    for (const m of allMembers ?? []) {
      memberCountMap.set(m.groupId, (memberCountMap.get(m.groupId) ?? 0) + 1);
    }
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl">
        {/* Bird painting background */}
        <img
          src="/birds.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Warm overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/40 to-stone-900/20" />

        <div className="relative z-10 p-6 sm:p-8 pt-16 sm:pt-24">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Hey {displayName}.
          </h1>
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your groups</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {groups.length === 0
                ? "Start a group and have fun."
                : groups.length === 1
                ? "1 circle of trust (financially speaking)"
                : `${groups.length} circles of trust (financially speaking)`}
            </p>
          </div>
          <CreateGroupButton userId={user.id} />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-stone-50/60 to-amber-50/40 px-5 py-10 sm:px-8 sm:py-14 text-center shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-stone-900/20 dark:to-amber-950/10">
            <div className="mb-4 sm:mb-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
            <p className="mb-1.5 text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200">Welcome to the nest</p>
            <p className="mx-auto mb-6 max-w-xs text-sm sm:text-base text-gray-500 dark:text-gray-400">
              Start a group to split expenses with friends, roommates, or travel buddies.
            </p>
            <div className="flex flex-col items-center gap-3">
              <CreateGroupButton userId={user.id} variant="large" />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Or ask a friend for an invite link to join theirs
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {groups.map((group) => {
              const palette = getGroupPalette(group.id);
              const initial = group.name.charAt(0).toUpperCase();
              const memberCount = memberCountMap.get(group.id) ?? 0;
              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className="group relative flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-800/80 dark:border-gray-700/60 dark:hover:border-gray-600"
                >
                  {/* Colored left accent bar */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-full transition-all duration-200 group-hover:top-2 group-hover:bottom-2"
                    style={{ background: `linear-gradient(to bottom, ${palette.from}, ${palette.to})` }}
                  />

                  {/* Monogram avatar */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-md transition-transform duration-200 group-hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
                  >
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">{group.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 10.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12.75 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </span>
                      <span className="hidden sm:inline">&middot;</span>
                      <span className="hidden sm:inline">
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Arrow — picks up the group's color on hover */}
                  <div className="flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 dark:text-gray-600">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bird fact */}
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-stone-50/80 px-5 py-4 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-stone-900/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">
          Bird fact
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)]}
        </p>
      </div>

      {/* Footer quip — only when there are groups */}
      {groups.length > 0 && (
        <p className="pb-2 text-center text-xs italic text-gray-400 dark:text-gray-500">
          Maybe the real financial independence is the friends we meticulously tracked along the way. 🪶
        </p>
      )}

      {/* Support + Legal links */}
      <div className="pb-4 text-center text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>
          <a
            href="https://buymeacoffee.com/gregbigelow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-700 dark:hover:text-amber-400"
          >
            Like Aviary? Buy me a coffee. 🙏
          </a>
        </p>
        <p>
          <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400">Privacy Policy</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-400">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
