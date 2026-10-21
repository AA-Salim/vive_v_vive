"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LiveProvider } from "@/components/live/live-provider"
import { useAuthSync } from "@/hooks/use-auth"

function AuthSync() {
  useAuthSync()
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            // LiveProvider already resyncs on focus and reconnect (throttled), so React Query does not have to.
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <LiveProvider>{children}</LiveProvider>
    </QueryClientProvider>
  )
}
