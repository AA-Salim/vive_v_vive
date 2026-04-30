"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import type { SessionWithAssignments } from "@/lib/types"

export function useSession() {
  const [session, setSession] = useState<SessionWithAssignments | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serverTimeDelta, setServerTimeDelta] = useState(0)
  const supabaseRef = useRef(createClient())

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions")
      const serverTime = res.headers.get("x-server-time")
      if (serverTime) {
        setServerTimeDelta(
          Date.now() - new Date(serverTime).getTime()
        )
      }
      const data = await res.json()
      setSession(data)
    } catch {
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel("session-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions" },
        () => {
          fetchSession()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_assignments" },
        () => {
          fetchSession()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chaos_actions" },
        () => {
          fetchSession()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSession])

  return { session, isLoading, refetch: fetchSession, serverTimeDelta }
}
