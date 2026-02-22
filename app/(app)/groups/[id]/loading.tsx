export default function GroupLoading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Back link + group name */}
      <div>
        <div className="mb-3 h-5 w-28 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-7 sm:h-8 w-48 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />

        {/* Member chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
              style={{ width: `${72 + i * 16}px` }}
            />
          ))}
        </div>
      </div>

      {/* Balances */}
      <section>
        <div className="h-6 w-24 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="h-4 w-40 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-14 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 w-24 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-9 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-24 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* Activity */}
      <section>
        <div className="h-6 w-20 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-56 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
