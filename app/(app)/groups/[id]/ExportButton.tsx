"use client";

import { useState } from "react";

export function ExportButton({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/export`);
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header, fallback to default
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "Expenses.xlsx";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — the user will see nothing downloaded
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:border-stone-300 active:scale-[0.97] dark:bg-stone-800 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:border-stone-500 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Export expenses to spreadsheet"
    >
      {/* Download/spreadsheet icon */}
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {loading ? "Exporting..." : "Export"}
    </button>
  );
}
