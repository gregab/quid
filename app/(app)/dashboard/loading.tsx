import { DelayedFallback } from "@/components/ui/DelayedFallback";

export default function DashboardLoading() {
  return (
    <DelayedFallback>
    <div className="space-y-6 sm:space-y-8">
      {/* Hero skeleton */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl bg-gray-200 dark:bg-gray-700 animate-pulse">
        <div className="p-6 sm:p-8 pt-16 sm:pt-24">
          <div className="h-8 w-48 rounded-lg bg-gray-300 dark:bg-gray-600" />
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="h-7 w-32 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="mt-1.5 h-4 w-64 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-36 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="h-4 w-4 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </DelayedFallback>
  );
}
