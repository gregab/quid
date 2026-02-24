import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";
import { formatCents } from "@/lib/format";

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

  // Overall balance across all groups (for summary display)
  const totalBalance = groups.reduce((sum, g) => sum + (balanceMap.get(g.id) ?? 0), 0);
  const hasAnyExpenses = groupsWithExpenses.size > 0;

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
        <div className="relative z-10 px-6 sm:px-8 pt-16 sm:pt-24 pb-6 sm:pb-8">
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
            Hey {displayName}.
          </h1>
          {hasAnyExpenses && (
            <p className="mt-1.5 text-base sm:text-lg font-medium text-white/90 drop-shadow-sm">
              Right now, you {totalBalance >= 0 ? "are owed" : "owe"}{" "}
              <span className={totalBalance > 0 ? "font-bold text-emerald-300" : "font-bold text-white"}>
                {formatCents(Math.abs(totalBalance))}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white">Your groups</h2>
            <CreateGroupButton userId={user.id} />
          </div>
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
          <div className="divide-y divide-stone-150 dark:divide-stone-800">
            {groups.map((group, i) => {
              const memberCount = memberCountMap.get(group.id) ?? 0;
              const balance = balanceMap.get(group.id) ?? 0;
              const hasExpenses = groupsWithExpenses.has(group.id);

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className="group-card group flex items-center gap-3 py-4 transition-colors duration-150 hover:bg-stone-50 dark:hover:bg-stone-900/50 -mx-2 px-2 rounded-lg"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Left: group info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base sm:text-[15px] font-semibold text-stone-900 dark:text-white">
                      {group.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-400 dark:text-stone-500">
                      <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                      <span className="text-stone-300 dark:text-stone-700">&middot;</span>
                      <span>
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Right: balance + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {balance !== 0 && (
                      <div className="text-right">
                        <p className={`text-[11px] ${
                          balance > 0
                            ? "text-emerald-600/70 dark:text-emerald-400/70"
                            : "text-rose-600/70 dark:text-rose-400/70"
                        }`}>
                          {balance > 0 ? "you are owed" : "you owe"}
                        </p>
                        <p className={`text-sm font-semibold ${
                          balance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatCents(Math.abs(balance))}
                        </p>
                      </div>
                    )}
                    {balance === 0 && hasExpenses && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          settled
                        </p>
                      </div>
                    )}
                    <svg
                      className="h-4 w-4 text-stone-300 dark:text-stone-600 transition-transform duration-150 group-hover:translate-x-0.5"
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
