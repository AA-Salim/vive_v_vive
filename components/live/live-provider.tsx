"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase-client"
import {
  ACTIVE_STATUSES,
  DB_TABLE_KEYS,
  LIVE_BROADCAST_EVENT,
  LIVE_TOPIC,
  domainOf,
  invalidationKeysFor,
  type LiveDomain,
  type LiveEvent,
} from "@/lib/live/events"
import { narrate } from "@/lib/live/narration"
import type { SessionWithAssignments } from "@/lib/types"

export type LiveStatus = "connecting" | "live" | "degraded"

export type LiveSignal =
  | { kind: "event"; event: LiveEvent }
  | { kind: "db"; table: string }
  | { kind: "sync"; reason: "visible" | "online" | "poll" | "reconnect" }

type Listener = (signal: LiveSignal) => void

interface LiveContextValue {
  status: LiveStatus
  feed: LiveEvent[]
  userId: string | null
  subscribe: (listener: Listener) => () => void
}

const LiveContext = createContext<LiveContextValue | null>(null)

const FEED_LIMIT = 60
const SEEN_LIMIT = 500
const HEALTHY_POLL_MS = 60_000
const DEGRADED_POLL_MS = 12_000

export const ACTIVE_SESSION_KEY = ["session", "active"] as const

export function LiveProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>("connecting")
  const [feed, setFeed] = useState<LiveEvent[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const listeners = useRef(new Set<Listener>())
  const seen = useRef(new Set<string>())

  const dispatch = useCallback((signal: LiveSignal) => {
    listeners.current.forEach((listener) => listener(signal))
  }, [])

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const syncAll = useCallback(
    (reason: "visible" | "online" | "poll" | "reconnect") => {
      queryClient.invalidateQueries()
      dispatch({ kind: "sync", reason })
    },
    [queryClient, dispatch]
  )

  const announce = useEffectEvent((event: LiveEvent) => {
    if (event.actor?.userId && event.actor.userId === userId) return
    const active = queryClient.getQueryData<{ session: SessionWithAssignments | null }>(ACTIVE_SESSION_KEY)
    const gameRunning = !!active?.session && ACTIVE_STATUSES.includes(active.session.status)
    if (!gameRunning && domainOf(event.type) !== "session") return
    const line = narrate(event)
    if (!line) return
    toast(line.title, { description: line.description })
  })

  const receive = useEffectEvent((event: LiveEvent) => {
    if (!event?.id || seen.current.has(event.id)) return
    if (seen.current.size > SEEN_LIMIT) seen.current.clear()
    seen.current.add(event.id)
    invalidationKeysFor(event).forEach((root) => queryClient.invalidateQueries({ queryKey: [root] }))
    setFeed((prev) => [event, ...prev].slice(0, FEED_LIMIT))
    dispatch({ kind: "event", event })
    announce(event)
  })

  const tableChanged = useEffectEvent((table: string) => {
    DB_TABLE_KEYS[table]?.forEach((root) => queryClient.invalidateQueries({ queryKey: [root] }))
    dispatch({ kind: "db", table })
  })

  const reconnected = useEffectEvent(() => syncAll("reconnect"))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let joinedBefore = false

    const broadcast = supabase
      .channel(LIVE_TOPIC)
      .on("broadcast", { event: LIVE_BROADCAST_EVENT }, ({ payload }) => receive(payload as LiveEvent))
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live")
          if (joinedBefore) reconnected()
          joinedBefore = true
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("degraded")
        }
      })

    // One channel per table: Supabase rejects a whole channel when any of its tables is unpublished.
    const tableChannels = Object.keys(DB_TABLE_KEYS).map((table) =>
      supabase
        .channel(`db-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => tableChanged(table))
        .subscribe()
    )

    return () => {
      supabase.removeChannel(broadcast)
      tableChannels.forEach((c) => supabase.removeChannel(c))
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(
      () => {
        if (document.visibilityState === "visible") syncAll("poll")
      },
      status === "live" ? HEALTHY_POLL_MS : DEGRADED_POLL_MS
    )
    return () => clearInterval(interval)
  }, [status, syncAll])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") syncAll("visible")
    }
    const onOnline = () => syncAll("online")
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [syncAll])

  return (
    <LiveContext.Provider value={{ status, feed, userId, subscribe }}>
      {children}
    </LiveContext.Provider>
  )
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext)
  if (!ctx) throw new Error("useLive must be used inside LiveProvider")
  return ctx
}

export function useLiveSignal(handler: Listener) {
  const { subscribe } = useLive()
  const onSignal = useEffectEvent(handler)
  useEffect(() => subscribe((signal) => onSignal(signal)), [subscribe])
}

// For components that fetch without React Query: refetch on matching events, table changes, or resyncs.
export function useLiveRefetch(
  refetch: () => void,
  match: { domains?: LiveDomain[]; tables?: string[]; sessionId?: string | null } = {}
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRefetch = useRef(refetch)
  useEffect(() => {
    latestRefetch.current = refetch
  })
  useLiveSignal((signal) => {
    const relevant =
      signal.kind === "sync" ||
      (signal.kind === "db" && !!match.tables?.includes(signal.table)) ||
      (signal.kind === "event" &&
        !!match.domains?.includes(domainOf(signal.event.type)) &&
        (!match.sessionId || !signal.event.sessionId || signal.event.sessionId === match.sessionId))
    if (!relevant) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => latestRefetch.current(), 250)
  })
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
}
