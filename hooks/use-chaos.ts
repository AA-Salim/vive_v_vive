"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import type { ChaosActionWithNames } from "@/lib/types"

export function useChaos(sessionId: string | null) {
  const [actions, setActions] = useState<ChaosActionWithNames[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const supabaseRef = useRef(createClient())

  const fetchActions = useCallback(async () => {
    if (!sessionId) {
      setActions([])
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/chaos`)
      if (res.ok) {
        const data = await res.json()
        setActions(data)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  useEffect(() => {
    if (!sessionId) return

    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`chaos-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chaos_actions",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchActions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchActions])

  return { actions, isLoading, refetch: fetchActions }
}
