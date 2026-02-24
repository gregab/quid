"use client";

import { useState } from "react";

export interface MemberColor {
  bg: string;
  text: string;
}

interface MemberPillProps {
  name: string;
  emoji?: string;
  color?: MemberColor;
  suffix?: string;
  title?: string;
  avatarUrl?: string | null;
}

export function MemberPill({ name, emoji, color, suffix, title, avatarUrl }: MemberPillProps) {
  const [imgError, setImgError] = useState(false);
  const colorClass = color
    ? `${color.bg} ${color.text}`
    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  const showAvatar = avatarUrl && !imgError;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colorClass}`}
    >
      {showAvatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt=""
          className="w-4 h-4 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        emoji && <span className="text-sm leading-none">{emoji}</span>
      )}
      <span>{name}</span>
      {suffix && <span className="opacity-50">{suffix}</span>}
    </span>
  );
}
