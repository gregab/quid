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
      await navigator.share({ url: inviteUrl });
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [canShare, inviteUrl]);

  return { canShare, copied, share };
}
