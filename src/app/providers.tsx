import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";

// Defaults kept conservative for a prototype: no aggressive background
// refetching. Realtime subscriptions (Phase 5/6/9, per Stage 18) are
// what trigger invalidation for live data — polling isn't the mechanism
// here, so a long staleTime avoids redundant refetches fighting with
// Realtime-driven cache updates.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
