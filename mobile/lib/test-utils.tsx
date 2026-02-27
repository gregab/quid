/**
 * Shared test utilities for mobile app tests.
 * Provides QueryClient wrapper and common mock factories.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ExpenseRow, GroupSummary, ActivityLog } from "./types";
import type { Member } from "./types";

/** Create a fresh QueryClient for tests (no retries, no GC delays). */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Wrapper component that provides QueryClient context. */
export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

/** Factory for mock GroupSummary objects. */
export function makeGroup(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: "group-1",
    name: "Test Group",
    createdAt: "2026-01-01T00:00:00Z",
    patternSeed: null,
    bannerUrl: null,
    emoji: null,
    memberCount: 2,
    balanceCents: 0,
    ...overrides,
  };
}

/** Factory for mock ExpenseRow objects. */
export function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: "expense-1",
    description: "Test expense",
    amountCents: 5000,
    date: "2026-02-20",
    paidById: "user-1",
    paidByDisplayName: "Alice",
    participantIds: ["user-1", "user-2"],
    splits: [
      { userId: "user-1", amountCents: 2500 },
      { userId: "user-2", amountCents: 2500 },
    ],
    splitType: "equal",
    canEdit: true,
    canDelete: true,
    isPayment: false,
    createdById: "user-1",
    ...overrides,
  };
}

/** Factory for mock Member objects. */
export function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    userId: "user-1",
    displayName: "Alice Wonderland",
    emoji: "🐦",
    ...overrides,
  };
}

/** Factory for mock ActivityLog objects. */
export function makeActivity(
  overrides: Partial<ActivityLog> = {},
): ActivityLog {
  return {
    id: "log-1",
    action: "expense_added",
    payload: { description: "Test", amountCents: 5000 },
    createdAt: "2026-02-20T12:00:00Z",
    actor: { displayName: "Alice" },
    ...overrides,
  };
}

/** Mock user object matching Supabase User shape. */
export const mockUser = {
  id: "user-1",
  email: "alice@example.com",
  user_metadata: { display_name: "Alice" },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
};

/** Mock group detail data as returned from Supabase. */
export function makeGroupDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    name: "Test Group",
    createdAt: "2026-01-01T00:00:00Z",
    createdById: "user-1",
    inviteToken: "invite-tok",
    GroupMember: [
      {
        userId: "user-1",
        User: { displayName: "Alice Wonderland", avatarUrl: null },
      },
      {
        userId: "user-2",
        User: { displayName: "Bob Smith", avatarUrl: null },
      },
    ],
    ...overrides,
  };
}
