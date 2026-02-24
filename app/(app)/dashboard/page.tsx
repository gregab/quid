import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";
import { formatCents } from "@/lib/format";

// Nature-inspired palettes — softer tints with a bold stripe accent.
// Card backgrounds are gentle washes; the stripe provides the pop of color.
const GROUP_PALETTES = [
  { stripe: "#d97706", card: "#fefbf3", accent: "#b45309" },  // honeycomb
  { stripe: "#0d9488", card: "#f3fdfb", accent: "#0f766e" },  // teal tanager
  { stripe: "#7c3aed", card: "#f8f5ff", accent: "#6d28d9" },  // iris
  { stripe: "#e11d48", card: "#fff5f6", accent: "#be123c" },  // rosefinch
  { stripe: "#2563eb", card: "#f3f7ff", accent: "#1d4ed8" },  // jay blue
  { stripe: "#059669", card: "#f2fdf8", accent: "#047857" },  // forest warbler
  { stripe: "#ea580c", card: "#fef7f2", accent: "#c2410c" },  // terracotta
  { stripe: "#9333ea", card: "#f9f5ff", accent: "#7c3aed" },  // plum starling
  { stripe: "#0284c7", card: "#f2f9ff", accent: "#0369a1" },  // kingfisher
  { stripe: "#ca8a04", card: "#fefdf3", accent: "#a16207" },  // ochre oriole
  { stripe: "#4f46e5", card: "#f3f4ff", accent: "#4338ca" },  // indigo bunting
  { stripe: "#dc2626", card: "#fef5f5", accent: "#b91c1c" },  // cardinal
];

function hashGroupId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Assign palettes to an ordered list of groups ensuring no two adjacent
// groups share the same color. Each group's palette is deterministic (based
// on its ID hash) but shifted if it would collide with its neighbor.
function assignGroupPalettes(groupIds: string[]) {
  const assignments = new Map<string, (typeof GROUP_PALETTES)[number]>();
  let prevIndex = -1;

  for (const id of groupIds) {
    let idx = hashGroupId(id) % GROUP_PALETTES.length;
    // If this would repeat the previous card's color, bump forward
    if (idx === prevIndex) {
      idx = (idx + 1) % GROUP_PALETTES.length;
    }
    assignments.set(id, GROUP_PALETTES[idx]!);
    prevIndex = idx;
  }

  return assignments;
}

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

  // Fetch expenses with splits for balance computation
  const balanceMap = new Map<string, number>();
  const groupsWithExpenses = new Set<string>();
  if (groups.length > 0) {
    const { data: expenses } = await supabase
      .from("Expense")
      .select("groupId, paidById, ExpenseSplit(userId, amountCents)")
      .in("groupId", groups.map((g) => g.id));
    if (expenses) {
      // Group expenses by groupId
      const byGroup = new Map<string, Array<{ paidById: string; splits: Array<{ userId: string; amountCents: number }> }>>();
      for (const e of expenses) {
        const gId = e.groupId;
        groupsWithExpenses.add(gId);
        if (!byGroup.has(gId)) byGroup.set(gId, []);
        byGroup.get(gId)!.push({
          paidById: e.paidById,
          splits: (e.ExpenseSplit ?? []) as Array<{ userId: string; amountCents: number }>,
        });
      }
      for (const [gId, exps] of byGroup) {
        balanceMap.set(gId, getUserBalanceCents(exps, user.id));
      }
    }
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

  const paletteMap = assignGroupPalettes(groups.map((g) => g.id));

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl">
        <img
          src="/birds.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/40 to-stone-900/20" />
        <div className="relative z-10 p-6 sm:p-8 pt-16 sm:pt-24">
          <h1 className="text-3xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Hey {displayName}.
          </h1>
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white">Your groups</h2>
            <p className="mt-0.5 text-sm sm:text-[13px] text-stone-500 dark:text-stone-400">
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
          <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-amber-50/60 via-stone-50 to-white px-5 py-12 sm:px-8 sm:py-16 text-center dark:border-stone-700/50 dark:from-amber-950/20 dark:via-stone-900/40 dark:to-stone-900/20">
            {/* Decorative background texture */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
            <div className="relative">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                style={{ background: "linear-gradient(135deg, #b45309, #92400e)" }}
              >
                <span className="text-2xl text-white" style={{ fontFamily: "var(--font-serif-logo)" }}>A</span>
              </div>
              <p className="mb-1.5 text-xl sm:text-lg font-bold text-stone-800 dark:text-stone-200">Welcome to the nest</p>
              <p className="mx-auto mb-7 max-w-xs text-base sm:text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                Start a group to split expenses with friends, roommates, or travel buddies.
              </p>
              <div className="flex flex-col items-center gap-3">
                <CreateGroupButton userId={user.id} variant="large" />
                <p className="text-sm sm:text-xs text-stone-500 dark:text-stone-400">
                  Or ask a friend for an invite link to join theirs
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {groups.map((group, i) => {
              const palette = paletteMap.get(group.id)!;
              const memberCount = memberCountMap.get(group.id) ?? 0;
              const balance = balanceMap.get(group.id) ?? 0;

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className="group-card group relative flex items-center gap-3 overflow-hidden rounded-2xl pl-0 pr-4 sm:pr-5 py-0 shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lg dark:shadow-none dark:hover:shadow-lg dark:hover:shadow-black/20"
                  style={{
                    background: palette.card,
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  {/* Color stripe */}
                  <div
                    className="self-stretch w-1.5 flex-shrink-0 rounded-l-2xl transition-all duration-300 group-hover:w-2"
                    style={{ background: palette.stripe }}
                  />

                  {/* Text content */}
                  <div className="relative min-w-0 flex-1 py-4">
                    <p className="truncate text-lg sm:text-[17px] font-bold tracking-tight text-stone-900 dark:text-white">
                      {group.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm sm:text-[13px] text-stone-400 dark:text-stone-500">
                      <svg className="h-3.5 w-3.5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{memberCount}</span>
                      <span className="text-stone-300 dark:text-stone-700">&middot;</span>
                      <span>
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Balance pill + arrow */}
                  <div className="relative flex items-center gap-2 flex-shrink-0">
                    {balance !== 0 && (
                      <div className={`px-2.5 py-1 rounded-lg text-[13px] font-semibold whitespace-nowrap ${
                        balance > 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                      }`}>
                        {balance > 0 ? `owed ${formatCents(balance)}` : `owe ${formatCents(Math.abs(balance))}`}
                      </div>
                    )}
                    {balance === 0 && groupsWithExpenses.has(group.id) && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[13px] font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        settled
                      </div>
                    )}
                    <svg
                      className="h-5 w-5 opacity-40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70"
                      style={{ color: palette.stripe }}
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

      {/* Bird fact — subtle editorial aside */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/60 bg-stone-50/80 px-5 py-4 dark:border-stone-700/40 dark:bg-stone-900/30">
        <div className="absolute top-3 right-4 text-[11px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300 dark:text-stone-700">
          Aviary
        </div>
        <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700/80 dark:text-amber-400/70">
          Bird fact
        </p>
        <p className="mt-1.5 text-base sm:text-sm leading-relaxed text-stone-700 dark:text-stone-300" style={{ fontFamily: "var(--font-serif-logo)" }}>
          {BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)]}
        </p>
      </div>

      {/* Footer quip — only when there are groups */}
      {groups.length > 0 && (
        <p className="pb-2 text-center text-sm sm:text-xs italic text-stone-500 dark:text-stone-400">
          Maybe the real financial independence is the friends we meticulously tracked along the way.
        </p>
      )}

      {/* Support + Legal links */}
      <div className="pb-4 text-center text-sm sm:text-xs text-stone-500 dark:text-stone-400 space-y-1">
        <p>
          <a
            href="https://buymeacoffee.com/gregbigelow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
          >
            Like Aviary? Buy me a coffee.
          </a>
        </p>
        <p>
          <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">Privacy Policy</Link>
          <span className="mx-2 text-stone-300 dark:text-stone-700">&middot;</span>
          <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
