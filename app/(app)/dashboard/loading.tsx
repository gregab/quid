import { DelayedFallback } from "@/components/ui/DelayedFallback";

export default function DashboardLoading() {
  return (
    <DelayedFallback>
    <div className="space-y-8 sm:space-y-10">
      {/* Hero skeleton */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl bg-stone-200 dark:bg-stone-700 animate-pulse">
        <div className="p-6 sm:p-8 pt-16 sm:pt-24">
          <div className="h-8 w-48 rounded-lg bg-stone-300 dark:bg-stone-600" />
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="h-6 w-28 rounded-md bg-stone-200 dark:bg-stone-700 animate-pulse" />
            <div className="mt-1.5 h-4 w-56 rounded-md bg-stone-200 dark:bg-stone-700 animate-pulse" />
          </div>
          <div className="h-9 w-24 rounded-full bg-stone-200 dark:bg-stone-700 animate-pulse" />
        </div>

        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800/60"
            >
              <div className="self-stretch w-1.5 rounded-l-2xl bg-stone-300 dark:bg-stone-600 animate-pulse" />
              <div className="min-w-0 flex-1 py-4 space-y-2">
                <div className="h-5 w-40 rounded-md bg-stone-200 dark:bg-stone-700 animate-pulse" />
                <div className="h-3.5 w-28 rounded-md bg-stone-200 dark:bg-stone-700 animate-pulse" />
              </div>
              <div className="h-5 w-5 mr-5 flex-shrink-0 rounded bg-stone-200 dark:bg-stone-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </DelayedFallback>
  );
}
