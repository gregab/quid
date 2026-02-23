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
}

export function MemberPill({ name, emoji, color, suffix, title }: MemberPillProps) {
  const colorClass = color
    ? `${color.bg} ${color.text}`
    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colorClass}`}
    >
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      <span>{name}</span>
      {suffix && <span className="opacity-50">{suffix}</span>}
    </span>
  );
}
