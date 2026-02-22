"use client";

import { useState } from "react";

export function CopyInviteLinkButton({ inviteToken }: { inviteToken: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary";
    const inviteUrl = `${siteUrl}/invite/${inviteToken}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer"
    >
      {copied ? "Copied!" : "Copy invite link"}
    </button>
  );
}
