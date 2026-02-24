import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";

// Nature-inspired palettes — warm, earthy tones that feel cohesive with the Aviary brand.
// Each has a rich bg for the monogram, a subtle wash tint for the card, and harmonious accents.
const GROUP_PALETTES = [
  { bg: "#b45309", wash: "#fffbeb", tint: "#fef3c7", text: "#92400e" },  // honeycomb
  { bg: "#0f766e", wash: "#f0fdfa", tint: "#ccfbf1", text: "#115e59" },  // deep teal
  { bg: "#9333ea", wash: "#faf5ff", tint: "#f3e8ff", text: "#6b21a8" },  // iris
  { bg: "#be123c", wash: "#fff1f2", tint: "#ffe4e6", text: "#9f1239" },  // rosefinch
  { bg: "#1d4ed8", wash: "#eff6ff", tint: "#dbeafe", text: "#1e40af" },  // jay blue
  { bg: "#047857", wash: "#ecfdf5", tint: "#d1fae5", text: "#065f46" },  // forest
  { bg: "#c2410c", wash: "#fff7ed", tint: "#ffedd5", text: "#9a3412" },  // terracotta
  { bg: "#7c3aed", wash: "#f5f3ff", tint: "#ede9fe", text: "#5b21b6" },  // plum
  { bg: "#0369a1", wash: "#f0f9ff", tint: "#e0f2fe", text: "#075985" },  // kingfisher
  { bg: "#a16207", wash: "#fefce8", tint: "#fef9c3", text: "#854d0e" },  // ochre
  { bg: "#4338ca", wash: "#eef2ff", tint: "#e0e7ff", text: "#3730a3" },  // indigo bunting
  { bg: "#b91c1c", wash: "#fef2f2", tint: "#fee2e2", text: "#991b1b" },  // cardinal
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

// Deterministic abstract pattern per group — a unique SVG "feather" motif
// based on the group ID hash. Creates visual fingerprinting without emojis.
function getGroupPattern(id: string): string {
  const h = hashGroupId(id);
  const shapes: string[] = [];
  // Generate 3-5 soft organic ellipses at different positions/rotations
  const count = 3 + (h % 3);
  for (let i = 0; i < count; i++) {
    const seed = hashGroupId(id + i.toString());
    const cx = 20 + (seed % 60);
    const cy = 15 + ((seed >> 4) % 70);
    const rx = 8 + (seed % 18);
    const ry = 4 + ((seed >> 3) % 12);
    const rotate = (seed % 180) - 90;
    const opacity = 0.06 + ((seed % 8) * 0.015);
    shapes.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})" fill="currentColor" opacity="${opacity.toFixed(3)}"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${shapes.join("")}</svg>`;
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

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

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
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Hey {displayName}.
          </h1>
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Your groups</h2>
            <p className="mt-0.5 text-[13px] text-gray-400 dark:text-gray-500">
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
              <p className="mb-1.5 text-lg font-bold text-gray-800 dark:text-gray-200">Welcome to the nest</p>
              <p className="mx-auto mb-7 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Start a group to split expenses with friends, roommates, or travel buddies.
              </p>
              <div className="flex flex-col items-center gap-3">
                <CreateGroupButton userId={user.id} variant="large" />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Or ask a friend for an invite link to join theirs
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, i) => {
              const palette = getGroupPalette(group.id);
              const initial = group.name.charAt(0).toUpperCase();
              const memberCount = memberCountMap.get(group.id) ?? 0;
              const patternSvg = getGroupPattern(group.id);
              const patternDataUri = `data:image/svg+xml,${encodeURIComponent(patternSvg.replace("currentColor", palette.bg))}`;

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className="group-card group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-white pl-5 pr-4 py-4 transition-all duration-300 hover:-translate-y-[2px] hover:shadow-xl dark:bg-gray-900/80"
                  style={{
                    borderColor: `color-mix(in srgb, ${palette.bg} 15%, transparent)`,
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  {/* Subtle pattern background — unique per group */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-70 dark:opacity-20 dark:group-hover:opacity-40"
                    style={{
                      backgroundImage: `url("${patternDataUri}")`,
                      backgroundSize: "140px 140px",
                      backgroundPosition: "right center",
                      backgroundRepeat: "no-repeat",
                    }}
                  />

                  {/* Tinted wash on the left edge */}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-24 opacity-30 dark:opacity-15"
                    style={{
                      background: `linear-gradient(to right, ${palette.tint}, transparent)`,
                    }}
                  />

                  {/* Monogram — uses the serif logo font for an editorial feel */}
                  <div
                    className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-[1.06]"
                    style={{
                      background: palette.bg,
                      boxShadow: `0 4px 14px -3px color-mix(in srgb, ${palette.bg} 40%, transparent)`,
                    }}
                  >
                    <span
                      className="text-xl leading-none"
                      style={{ fontFamily: "var(--font-serif-logo)" }}
                    >
                      {initial}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">
                      {group.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span style={{ color: palette.text }} className="font-medium dark:opacity-80">
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">/</span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div
                    className="relative flex-shrink-0 transition-all duration-300 group-hover:translate-x-1"
                    style={{ color: palette.bg }}
                  >
                    <svg className="h-4 w-4 opacity-40 transition-opacity duration-300 group-hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
        <div className="absolute top-3 right-4 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300 dark:text-stone-700">
          Aviary
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700/60 dark:text-amber-400/50">
          Bird fact
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400" style={{ fontFamily: "var(--font-serif-logo)" }}>
          {BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)]}
        </p>
      </div>

      {/* Footer quip — only when there are groups */}
      {groups.length > 0 && (
        <p className="pb-2 text-center text-xs italic text-gray-400 dark:text-gray-500">
          Maybe the real financial independence is the friends we meticulously tracked along the way.
        </p>
      )}

      {/* Support + Legal links */}
      <div className="pb-4 text-center text-xs text-gray-400 dark:text-gray-500 space-y-1">
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
          <span className="mx-2 text-gray-300 dark:text-gray-700">&middot;</span>
          <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
