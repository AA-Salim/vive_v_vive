"use client"

import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { ACTIVE_SESSION_KEY } from "@/lib/live/events"
import type { SessionWithAssignments } from "@/lib/types"

interface ActiveSession {
  session: SessionWithAssignments | null
  serverTimeDelta: number
}

async function fetchActiveSession(): Promise<ActiveSession> {
  const res = await fetch("/api/sessions", { cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/sessions failed with ${res.status}`)
  const serverTime = res.headers.get("x-server-time")
  const session = (await res.json()) as SessionWithAssignments | null
  return {
    session: session && Array.isArray(session.session_assignments) ? session : null,
    serverTimeDelta: serverTime ? Date.now() - new Date(serverTime).getTime() : 0,
  }
}

export function useSession() {
  const query = useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: fetchActiveSession,
    staleTime: 2_000,
  })

  const { refetch: refetchQuery } = query
  const refetch = useCallback(async () => {
    await refetchQuery()
  }, [refetchQuery])

  return {
    session: query.data?.session ?? null,
    isLoading: query.isPending,
    refetch,
    serverTimeDelta: query.data?.serverTimeDelta ?? 0,
  }
}
