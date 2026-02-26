/** Centralized query key factory for TanStack Query cache management. */

export const groupKeys = {
  all: ["groups"] as const,
  detail: (id: string) => ["groups", id] as const,
  expenses: (id: string) => ["groups", id, "expenses"] as const,
  balances: (id: string) => ["groups", id, "balances"] as const,
  activity: (id: string) => ["groups", id, "activity"] as const,
  members: (id: string) => ["groups", id, "members"] as const,
  recurringExpenses: (id: string) => ["groups", id, "recurringExpenses"] as const,
};

export const userKeys = {
  current: ["user", "current"] as const,
  profile: ["user", "profile"] as const,
};

export const inviteKeys = {
  preview: (token: string) => ["invite", token] as const,
};
