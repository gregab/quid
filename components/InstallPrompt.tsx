"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "aviary-install-dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as unknown as { standalone: boolean }).standalone);
    setIsStandalone(!!standalone);

    // Check if previously dismissed
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // Listen for Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  }, []);

  // Don't render if: already installed, dismissed, or no install signal
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="install-prompt mt-6 w-full max-w-md animate-[slide-up_0.4s_ease-out_both] px-4">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/90">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
          aria-label="Dismiss install prompt"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>

        <div className="flex items-start gap-3.5">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/40">
            🕊️
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              Add Aviary to Home Screen
            </p>

            {isIOS ? (
              // iOS: manual instructions (no native prompt API)
              <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                Tap{" "}
                <span className="inline-flex translate-y-px items-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-600 dark:text-amber-400"
                  >
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </span>{" "}
                Share, then &ldquo;Add to Home Screen&rdquo;
              </p>
            ) : (
              // Android/Chrome: native install prompt
              <div className="mt-2.5">
                <button
                  onClick={handleInstall}
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-700 active:scale-[0.97] dark:bg-amber-500 dark:hover:bg-amber-600"
                >
                  Install App
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
