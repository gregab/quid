"use client";

import { useState, useEffect, useCallback } from "react";

export function useInviteShare(inviteToken: string) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/invite/${inviteToken}`;

  const share = useCallback(async () => {
    if (canShare) {
      try {
        await navigator.share({ url: inviteUrl });
      } catch {
        // User cancelled the share sheet — ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
      } catch {
        // Clipboard API unavailable (e.g. insecure context) — use legacy fallback
        const textarea = document.createElement("textarea");
        textarea.value = inviteUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [canShare, inviteUrl]);

  return { canShare, copied, share };
}
