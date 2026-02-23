"use client";

import { useInviteShare } from "./useInviteShare";

export function CopyInviteLinkButton({ inviteToken }: { inviteToken: string }) {
  const { canShare, copied, share } = useInviteShare(inviteToken);

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 active:scale-[0.97] dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:border-amber-600 transition-all cursor-pointer shadow-sm"
    >
      {canShare ? (
        /* Share icon (arrow-up-from-box) */
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M12 15V2.25m0 0 3 3m-3-3-3 3" />
        </svg>
      ) : (
        /* Link icon */
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.656a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.69" />
        </svg>
      )}
      {copied ? "Copied!" : canShare ? "Share invite" : "Copy invite link"}
    </button>
  );
}
