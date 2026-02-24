"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";

interface GroupBalance {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

interface SettingsClientProps {
  email: string;
  userId: string;
  displayName: string;
  profilePictureUrl: string | null;
  avatarUrl: string | null;
  defaultEmoji: string;
}

export function SettingsClient({
  email,
  userId,
  displayName,
  profilePictureUrl,
  avatarUrl,
  defaultEmoji,
}: SettingsClientProps) {
  const router = useRouter();

  // Profile picture state
  const [currentProfilePic, setCurrentProfilePic] = useState(profilePictureUrl);
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [picError, setPicError] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Delete account state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [groupBalances, setGroupBalances] = useState<GroupBalance[] | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = isPending || uploading;

  // Resolved display avatar: manual > Google > emoji
  const resolvedAvatarUrl = currentProfilePic ?? avatarUrl;

  // --- Profile picture handlers ---

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    const url = URL.createObjectURL(file);
    setPendingObjectUrl(url);
    setImgDisplaySize(null);
    setPan({ x: 0, y: 0 });
    setPicError(null);
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

    const cropX = Math.round(-pan.x / scale);
    const cropY = Math.round(-pan.y / scale);
    const cropSize = Math.round(cW / scale); // Square crop

    const canvas = document.createElement("canvas");
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

    const croppedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.95,
      );
    });

    const croppedFile = new File([croppedBlob], "profile.jpg", { type: "image/jpeg" });
    const compressed = await compressImage(croppedFile, { maxWidth: 512, maxHeight: 512 });

    const supabase = createClient();
    const path = `${userId}/profile.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("user-profiles")
      .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("user-profiles").getPublicUrl(path);

    URL.revokeObjectURL(pendingObjectUrl);
    setPendingObjectUrl(null);
    setImgDisplaySize(null);

    return `${publicUrl}?t=${Date.now()}`;
  }

  async function handleSaveProfilePic() {
    setPicError(null);

    if (!pendingObjectUrl) return;

    setUploading(true);
    let finalUrl: string;
    try {
      finalUrl = await cropAndUpload();
    } catch (err) {
      setPicError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      return;
    }
    setUploading(false);

    startTransition(async () => {
      const res = await fetch("/api/account/profile-picture", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePictureUrl: finalUrl }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setPicError(json.error ?? "Failed to save");
        return;
      }

      setCurrentProfilePic(finalUrl);
      setImgLoadError(false);
      router.refresh();
    });
  }

  async function handleRemoveProfilePic() {
    setPicError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/profile-picture", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePictureUrl: null }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setPicError(json.error ?? "Failed to remove");
        return;
      }

      setCurrentProfilePic(null);
      setImgLoadError(false);
      router.refresh();
    });
  }

  // --- Delete account handlers ---

  async function openConfirm() {
    setConfirmOpen(true);
    setConfirmText("");
    setError(null);
    setGroupBalances(null);
    setLoadingBalances(true);

    const res = await fetch(`/api/account`);
    const json = (await res.json()) as {
      data: { groupBalances: GroupBalance[] } | null;
      error?: string;
    };

    setLoadingBalances(false);
    setGroupBalances(json.data?.groupBalances ?? []);
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/account`, { method: "DELETE" });
    const json = (await res.json()) as { data?: { deleted: boolean }; error?: string };

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  function formatBalance(cents: number): string {
    const abs = Math.abs(cents);
    return `$${(abs / 100).toFixed(2)}`;
  }

  const hasOutstandingBalances = (groupBalances ?? []).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account
        </p>
      </div>

      {/* Profile picture */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile picture</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          This is how you appear to other group members.
        </p>

        <div className="mt-4 flex items-start gap-6">
          {/* Current avatar preview */}
          {!pendingObjectUrl && (
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                {resolvedAvatarUrl && !imgLoadError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={resolvedAvatarUrl}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover"
                    onError={() => setImgLoadError(true)}
                  />
                ) : (
                  <span className="text-4xl">{defaultEmoji}</span>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-gray-400">{displayName}</p>
            </div>
          )}

          {/* Pan/crop UI */}
          {pendingObjectUrl ? (
            <div className="flex-1">
              <div
                ref={containerRef}
                data-testid="pan-container"
                className="relative w-40 h-40 rounded-full overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none bg-gray-100 dark:bg-gray-800 mx-auto"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={panImgRef}
                  src={pendingObjectUrl}
                  alt="Position your photo"
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
                {/* Drag hint */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white pointer-events-none whitespace-nowrap">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                  </svg>
                  Drag to reposition
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelCrop}
                  disabled={isBusy}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfilePic}
                  disabled={isBusy}
                  className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Uploading…" : isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {currentProfilePic ? "Change photo" : "Upload photo"}
              </button>
              {currentProfilePic && (
                <button
                  type="button"
                  onClick={handleRemoveProfilePic}
                  disabled={isBusy}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {picError && (
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {picError}
          </p>
        )}
      </div>

      {/* Account info */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Signed in as <span className="font-medium text-gray-900 dark:text-white">{email}</span>
        </p>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/50 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={openConfirm}>
            Delete account
          </Button>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setConfirmOpen(false); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete your account?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will permanently delete your account, remove you from all groups, and erase your data. This cannot be undone.
            </p>

            {loadingBalances ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking balances…
              </div>
            ) : hasOutstandingBalances ? (
              <>
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    You must settle up before deleting your account. Outstanding balances in:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {groupBalances!.map((gb) => (
                      <li key={gb.groupId} className="text-sm text-red-700 dark:text-red-400">
                        <Link
                          href={`/groups/${gb.groupId}`}
                          className="font-medium underline hover:opacity-70 transition-opacity"
                          onClick={() => setConfirmOpen(false)}
                        >
                          {gb.groupName}
                        </Link>:{" "}
                        {gb.balanceCents > 0
                          ? `you are owed ${formatBalance(gb.balanceCents)}`
                          : `you owe ${formatBalance(gb.balanceCents)}`}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4">
                  <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type <span className="font-bold">FAREWELL</span> to confirm
                  </label>
                  <input
                    id="confirmDelete"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="FAREWELL"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>

                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="mt-5 flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={loading || confirmText !== "FAREWELL"}
                  >
                    {loading ? "Deleting..." : "Delete my account"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
