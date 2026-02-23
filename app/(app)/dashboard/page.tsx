import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";

const GROUP_EMOJIS = ["🐦", "🦅", "🕊️", "🦉", "🦆", "🐧", "🦜", "🦢", "🦩", "🐓", "🦚", "🪶", "🐤", "🐣", "🌞"];

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

// Hash-based emoji assignment: each group gets a unique emoji derived from its ID.
// Sorted by hash before assigning so collision resolution is stable regardless of input order.
function assignGroupEmojis(groupIds: string[]): Map<string, string> {
  const hash = (id: string) =>
    id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const sorted = [...groupIds].sort((a, b) => hash(a) - hash(b));
  const used = new Set<number>();
  const result = new Map<string, string>();
  for (const id of sorted) {
    let idx = hash(id) % GROUP_EMOJIS.length;
    while (used.has(idx)) idx = (idx + 1) % GROUP_EMOJIS.length;
    used.add(idx);
    result.set(id, GROUP_EMOJIS[idx]!);
  }
  return result;
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

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

  const emojiMap = assignGroupEmojis(groups.map((g) => g.id));

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
            <div className="mb-3 sm:mb-4 text-5xl sm:text-6xl">🪺</div>
            <p className="mb-2 text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300">No groups yet</p>
            <p className="mx-auto max-w-sm text-sm sm:text-base text-gray-500 dark:text-gray-400">
              An empty nest. Start a group and get your birds in a row.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                prefetch={false}
                className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:bg-gray-800 dark:border-gray-700 dark:hover:border-amber-500"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 text-2xl shadow-inner dark:from-amber-900 dark:to-stone-800">
                  {emojiMap.get(group.id)}
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
                  className="h-4 w-4 flex-shrink-0 text-gray-300 transition-colors group-hover:text-amber-600"
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
