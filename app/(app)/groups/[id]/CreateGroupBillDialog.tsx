"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CreateGroupBillDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (bill: { id: string }) => void;
}

function filenameToName(filename: string): string {
  // Strip extension, replace underscores/hyphens with spaces, trim
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export function CreateGroupBillDialog({
  groupId,
  open,
  onClose,
  onCreated,
}: CreateGroupBillDialogProps) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !name) {
      setName(filenameToName(selected.name));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a receipt image.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a bill name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", name.trim());

      const res = await fetch(`/api/groups/${groupId}/bills`, {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { data: { id: string } | null; error: string | null };

      if (!res.ok || !json.data) {
        setError(json.error ?? "Failed to create bill. Please try again.");
        return;
      }

      onCreated({ id: json.data.id });
      // Reset state
      setName("");
      setFile(null);
      setError(null);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-stone-200 dark:bg-stone-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:pt-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-600 dark:text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white">Scan Receipt</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
            <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Scanning receipt&hellip;</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 text-center max-w-[200px]">
              Reading items and amounts with AI
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 pb-5">
            <div className="space-y-4">
              {/* Receipt image upload */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5">
                  Receipt photo
                </label>
                <div
                  className="relative cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className={`w-full rounded-xl border-2 border-dashed transition-colors px-4 py-5 flex flex-col items-center gap-2 ${
                      file
                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10"
                        : "border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-700 bg-stone-50 dark:bg-stone-800/40"
                    }`}
                  >
                    {file ? (
                      <>
                        <svg
                          className="w-5 h-5 text-amber-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className="text-sm text-stone-700 dark:text-stone-300 font-medium truncate max-w-full">
                          {file.name}
                        </span>
                        <span className="text-xs text-stone-400">Tap to change</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-6 h-6 text-stone-300 dark:text-stone-600"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                        <span className="text-sm text-stone-500 dark:text-stone-400">
                          Tap to take or choose a photo
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Bill name */}
              <div>
                <label
                  htmlFor="bill-name"
                  className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5"
                >
                  Bill name
                </label>
                <Input
                  id="bill-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dinner at Nobu, Grocery run"
                  maxLength={100}
                  autoComplete="off"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              )}
            </div>

            <div className="mt-5 flex gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!file || !name.trim()}
                className="flex-1"
              >
                Create Bill
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
