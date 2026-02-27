/**
 * Shared test utilities for TanStack Query hook tests.
 * Provides a wrapper with QueryClientProvider and mocked AuthProvider.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** Create a fresh QueryClient for each test with no retries. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // 1ms gcTime: tiny enough to let fork worker event loops drain after
        // tests complete, large enough that synchronous assertions after
        // mutateAsync still see cache data (GC fires as a macro task, not inline)
        gcTime: 1,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Wrapper component for renderHook that provides QueryClientProvider. */
export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
