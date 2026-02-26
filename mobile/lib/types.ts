// Re-export platform-agnostic types from shared package
export type {
  ExpenseRow,
  ActivityLog,
  UserOwesDebt,
  SplitEntry,
  ResolvedDebt,
  GroupSummary,
  Contact,
} from "@aviary/shared";

// Platform-specific types (mobile uses color names, web uses Tailwind class objects)
export type MemberColor =
  | "rose"
  | "sky"
  | "violet"
  | "lime"
  | "orange"
  | "teal"
  | "fuchsia"
  | "amber"
  | "emerald"
  | "pink"
  | "indigo"
  | "cyan";

export interface Member {
  userId: string;
  displayName: string;
  emoji?: string;
  color?: MemberColor;
  avatarUrl?: string | null;
}
