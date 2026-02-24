"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";

interface Props {
  groupId: string;
  currentGroupName: string;
  currentBannerUrl: string | null;
  onClose: () => void;
}

export function GroupSettingsModal({
  groupId,
  currentGroupName,
  currentBannerUrl,
  onClose,
}: Props) {
  const router = useRouter();
  const [groupName, setGroupName] = useState(currentGroupName);
  const [bannerUrl, setBannerUrl] = useState<string | null>(currentBannerUrl);
  const [bannerPreview, setBannerPreview] = useState<string | null>(currentBannerUrl);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pan/crop state — set when user picks a file, cleared after apply or cancel
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const panImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = isPending || uploading;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up any previous pending URL
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);

    const url = URL.createObjectURL(file);
    setPendingObjectUrl(url);
    setImgDisplaySize(null);
    setPan({ x: 0, y: 0 });
    setError(null);

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function handlePanImgLoad() {
    const img = panImgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const cW = container.clientWidth;
    const cH = container.clientHeight;

    const scale = Math.max(cW / natW, cH / natH);
    const displayW = natW * scale;
    const displayH = natH * scale;

    setImgDisplaySize({ w: displayW, h: displayH });
    // Center the image in the container
    setPan({ x: (cW - displayW) / 2, y: (cH - displayH) / 2 });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !containerRef.current || !imgDisplaySize) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;

    setPan({
      x: Math.min(0, Math.max(cW - imgDisplaySize.w, dragRef.current.startPanX + dx)),
      y: Math.min(0, Math.max(cH - imgDisplaySize.h, dragRef.current.startPanY + dy)),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleCancelCrop() {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    setPendingObjectUrl(null);
    setImgDisplaySize(null);
  }

  async function cropAndUpload(): Promise<string> {
    if (!pendingObjectUrl || !containerRef.current || !imgDisplaySize || !panImgRef.current) {
      throw new Error("Crop state missing");
    }

    const img = panImgRef.current;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const scale = Math.max(cW / natW, cH / natH);

    // Crop region in natural image coordinates
    const cropX = Math.round(-pan.x / scale);
    const cropY = Math.round(-pan.y / scale);
    const cropW = Math.round(cW / scale);
    const cropH = Math.round(cH / scale);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const croppedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.95
      );
    });

    // compressImage handles resizing to MAX_WIDTH × MAX_HEIGHT and quality reduction
    const croppedFile = new File([croppedBlob], "banner.jpg", { type: "image/jpeg" });
    const compressed = await compressImage(croppedFile);

    const supabase = createClient();
    const path = `${groupId}/banner.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("group-banners")
      .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from("group-banners")
      .getPublicUrl(path);

    URL.revokeObjectURL(pendingObjectUrl);
    setPendingObjectUrl(null);
    setImgDisplaySize(null);

    return `${publicUrl}?t=${Date.now()}`;
  }

  function handleRemoveBanner() {
    setBannerUrl(null);
    setBannerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setError(null);

    let finalBannerUrl = bannerUrl;

    // If the user picked a new image and hasn't applied it yet, crop+upload now
    if (pendingObjectUrl) {
      setUploading(true);
      try {
        finalBannerUrl = await cropAndUpload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(async () => {
      const res = await fetch(`/api/groups/${groupId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(groupName !== currentGroupName && { name: groupName }),
          bannerUrl: finalBannerUrl || null,
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
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base font-semibold text-stone-900 dark:text-white">Group settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Group name */}
          <div>
            <label htmlFor="group-name" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Banner image */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Banner image
            </label>

            {pendingObjectUrl ? (
              /* Pan/crop UI */
              <div>
                <div
                  ref={containerRef}
                  data-testid="pan-container"
                  className="relative rounded-xl overflow-hidden h-28 cursor-grab active:cursor-grabbing select-none touch-none bg-stone-100 dark:bg-stone-800"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={panImgRef}
                    src={pendingObjectUrl}
                    alt="Position your banner"
                    draggable={false}
                    onLoad={handlePanImgLoad}
                    style={
                      imgDisplaySize
                        ? {
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: imgDisplaySize.w,
                            height: imgDisplaySize.h,
                            transform: `translate(${pan.x}px, ${pan.y}px)`,
                            pointerEvents: "none",
                            userSelect: "none",
                          }
                        : { display: "none" }
                    }
                  />
                  {/* Drag hint overlay */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white pointer-events-none whitespace-nowrap">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                    Drag to reposition
                  </div>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleCancelCrop}
                    disabled={isBusy}
                    className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : bannerPreview ? (
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
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 px-4 py-8 text-sm text-stone-400 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <span>Upload banner</span>
                <span className="text-xs">JPEG, PNG, or WebP</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {bannerPreview && !pendingObjectUrl && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                Change image
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
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
