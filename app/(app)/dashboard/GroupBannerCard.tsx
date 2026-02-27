import Link from "next/link";
import { generateGroupBanner } from "@/lib/groupPattern";
import { formatCents } from "@/lib/format";

interface GroupBannerCardProps {
  id: string;
  name: string;
  patternSeed: number;
  bannerUrl: string | null;
  memberCount: number;
  createdAt: string;
  balance: number;
  hasExpenses: boolean;
  animationDelay?: number;
}

export function GroupBannerCard({
  id,
  name,
  patternSeed,
  bannerUrl,
  memberCount,
  createdAt,
  balance,
  hasExpenses,
  animationDelay = 0,
}: GroupBannerCardProps) {
  const { lightSvg, darkSvg } = bannerUrl ? { lightSvg: "", darkSvg: "" } : generateGroupBanner(patternSeed);

  const monthYear = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/groups/${id}`}
      prefetch={false}
      className="group block rounded-2xl overflow-hidden border border-stone-200/70 dark:border-stone-800/60 bg-white dark:bg-stone-900 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <div
              className="absolute inset-0 dark:hidden"
              dangerouslySetInnerHTML={{ __html: lightSvg }}
            />
            <div
              className="absolute inset-0 hidden dark:block"
              dangerouslySetInnerHTML={{ __html: darkSvg }}
            />
          </>
        )}
        {/* Gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {/* Group name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
          <p className="text-[13px] font-bold text-white leading-snug line-clamp-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
            {name}
          </p>
        </div>
        {/* Balance badge — top right corner */}
        {balance !== 0 && (
          <div className="absolute top-2 right-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${
                balance > 0
                  ? "bg-emerald-500/80 text-white"
                  : "bg-rose-500/80 text-white"
              }`}
            >
              {balance > 0 ? "+" : "-"}{formatCents(Math.abs(balance))}
            </span>
          </div>
        )}
        {balance === 0 && hasExpenses && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-white/20 text-white backdrop-blur-sm">
              settled
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between">
        <p className="text-[12px] text-stone-400 dark:text-stone-500">
          {memberCount} {memberCount === 1 ? "member" : "members"} · {monthYear}
        </p>
        <svg
          className="h-3.5 w-3.5 text-stone-300 dark:text-stone-600 transition-transform duration-150 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
