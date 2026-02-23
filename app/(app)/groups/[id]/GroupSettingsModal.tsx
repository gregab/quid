"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";

interface Props {
  groupId: string;
  currentEmoji: string | null;
  currentBannerUrl: string | null;
  defaultEmoji: string;
  onClose: () => void;
}

export function GroupSettingsModal({
  groupId,
  currentEmoji,
  currentBannerUrl,
  defaultEmoji,
  onClose,
}: Props) {
  const router = useRouter();
  const [emoji, setEmoji] = useState(currentEmoji ?? "");
  const [bannerUrl, setBannerUrl] = useState<string | null>(currentBannerUrl);
  const [bannerPreview, setBannerPreview] = useState<string | null>(currentBannerUrl);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isPending || uploading;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      const supabase = createClient();
      const path = `${groupId}/banner.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("group-banners")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("group-banners")
        .getPublicUrl(path);

      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      setBannerUrl(urlWithBust);
      setBannerPreview(urlWithBust);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveBanner() {
    setBannerUrl(null);
    setBannerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/groups/${groupId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emoji: emoji.trim() || null,
          bannerUrl: bannerUrl || null,
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Failed to save");
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Group settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Group emoji
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 text-2xl shadow-inner dark:from-amber-900 dark:to-stone-800">
                {emoji || defaultEmoji}
              </div>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder={`Default: ${defaultEmoji}`}
                maxLength={8}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-lg text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {emoji && (
                <button
                  type="button"
                  onClick={() => setEmoji("")}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">Type or paste any emoji</p>
          </div>

          {/* Banner image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Banner image
            </label>

            {bannerPreview ? (
              <div className="relative rounded-xl overflow-hidden h-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-sm text-gray-400 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                )}
                <span>{uploading ? "Uploading…" : "Upload banner"}</span>
                <span className="text-xs">JPEG, PNG, WebP · max 2 MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {bannerPreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 text-xs text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Change image"}
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
