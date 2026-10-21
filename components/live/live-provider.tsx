"use client"

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase-client"
import {
  ACTIVE_SESSION_KEY,
  ACTIVE_STATUSES,
  DB_TABLE_KEYS,
  LIVE_BROADCAST_EVENT,
  LIVE_TOPIC,
  RESOLVED_STATUSES,
  STABLE_ROOTS,
  dbTargetsFor,
  invalidationTargetsFor,
  parseLiveEvent,
  rowToLiveEvent,
  type LiveEvent,
  type LiveEventPayloads,
} from "@/lib/live/events"
import { livePhase, type Viewer } from "@/lib/live/policy"
import { primeAudio } from "@/lib/live/cues"
import { LiveAnnouncer } from "@/components/live/live-announcer"
import {
  LiveBusContext,
  LiveContext,
  type LiveContextValue,
  type LiveListener,
  type LiveSignal,
  type LiveStatus,
  type LiveSyncReason,
} from "@/components/live/live-context"
import { InvalidationQueue, SeenIds } from "@/components/live/invalidation-queue"
import { useAuth } from "@/hooks/use-auth"
import { useLivePrefs } from "@/hooks/use-live-prefs"
import { useSession } from "@/hooks/use-session"
import type { SessionStatus } from "@/lib/types"

export { ACTIVE_SESSION_KEY }
export { useLive, useLiveRefetch, useLiveSignal } from "@/components/live/live-context"
export type { LiveContextValue, LiveSignal, LiveStatus, LiveSyncReason } from "@/components/live/live-context"

const FEED_LIMIT = 60
const HEALTHY_POLL_MS = 60_000
const DEGRADED_POLL_MS = 12_000
const MIN_SYNC_GAP_MS = 2_000
const HIDDEN_RESYNC_MS = 1_500
const LATE_JOIN_MS = 2_500

type Row = Record<string, unknown>

function rowOf(payload: { new?: unknown; old?: unknown }): Row | null {
  const fresh = payload.new as Row | undefined
  if (fresh && Object.keys(fresh).length > 0) return fresh
  return (payload.old as Row | undefined) ?? null
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const { session, serverTimeDelta } = useSession()
  const [prefs] = useLivePrefs()
  const [status, setStatus] = useState<LiveStatus>("connecting")
  const [feed, setFeed] = useState<LiveEvent[]>([])
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [announcer] = useState(() => new LiveAnnouncer())
  const [seen] = useState(() => new SeenIds())
  const [queue] = useState(() => new InvalidationQueue(queryClient))
  const listeners = useRef(new Set<LiveListener>())
  const lastSyncAt = useRef(0)
  const phase = useRef<{ status: SessionStatus | null; endedAt: number | null }>({ status: null, endedAt: null })

  const userId = user?.id ?? null
  const playerName = profile?.players?.name ?? null
  const discordName = profile?.discord_username ?? null
  const sessionStatus = session?.status ?? null
  // A game that ended moments ago (served as a recent result) still has its aftermath ahead after a reload.
  const resolvedAt = session && RESOLVED_STATUSES.includes(session.status) ? Date.parse(session.updated_at) : null
  // Whole seconds: the measured delta jitters on every session refetch and would re-render every consumer.
  const clockOffset = Math.round(serverTimeDelta / 1000) * 1000

  const viewer = useMemo<Viewer>(
    () => ({ userId, names: [playerName, discordName].filter((n): n is string => !!n) }),
    [userId, playerName, discordName]
  )

  const dispatch = useCallback((signal: LiveSignal) => {
    listeners.current.forEach((listener) => listener(signal))
  }, [])

  const subscribe = useCallback((listener: LiveListener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const syncAll = useCallback(
    (reason: LiveSyncReason) => {
      const now = Date.now()
      if (reason !== "manual" && reason !== "reconnect" && now - lastSyncAt.current < MIN_SYNC_GAP_MS) return
      lastSyncAt.current = now
      if (reason === "poll") {
        queryClient.invalidateQueries({ predicate: (q) => !STABLE_ROOTS.includes(String(q.queryKey[0])) })
      } else {
        queryClient.invalidateQueries()
      }
      dispatch({ kind: "sync", reason })
    },
    [queryClient, dispatch]
  )

  const resync = useCallback(() => syncAll("manual"), [syncAll])

  const trackPhase = useEffectEvent((event: LiveEvent) => {
    if (event.type === "session.created") {
      const mode = (event.data as LiveEventPayloads["session.created"]).mode
      phase.current.status = mode === "coach_draft" ? "coach_draft" : "draft"
    } else if (event.type === "session.status") {
      const to = (event.data as LiveEventPayloads["session.status"]).to
      if (RESOLVED_STATUSES.includes(to)) {
        phase.current = { status: null, endedAt: Date.now() }
      } else {
        phase.current.status = to
      }
    }
  })

  const receive = useEffectEvent((raw: unknown) => {
    const event = parseLiveEvent(raw)
    if (!event || !seen.add(event.id)) return
    trackPhase(event)
    queue.push(invalidationTargetsFor(event))
    setFeed((prev) => [event, ...prev].slice(0, FEED_LIMIT))
    setLastEventAt(Date.now())
    dispatch({ kind: "event", event })
    announcer.announce(event, {
      phase: livePhase(phase.current.status, phase.current.endedAt, Date.now()),
      viewer,
      prefs,
    })
  })

  const tableChanged = useEffectEvent((table: string, row: Row | null) => {
    queue.push(dbTargetsFor(table, row))
    dispatch({ kind: "db", table })
  })

  const joined = useEffectEvent((first: boolean, waitedMs: number) => {
    setStatus("live")
    if (!first || waitedMs > LATE_JOIN_MS) syncAll("reconnect")
  })

  useEffect(() => {
    const p = phase.current
    const wasActive = !!p.status && ACTIVE_STATUSES.includes(p.status)
    const isActive = !!sessionStatus && ACTIVE_STATUSES.includes(sessionStatus)
    if (wasActive && !isActive) p.endedAt = Date.now()
    else if (!isActive && p.endedAt === null && resolvedAt !== null && Number.isFinite(resolvedAt)) {
      p.endedAt = Math.min(Date.now(), resolvedAt + clockOffset)
    }
    p.status = sessionStatus
  }, [sessionStatus, resolvedAt, clockOffset])

  useEffect(() => {
    const supabase = createClient()
    const startedAt = Date.now()
    let joinedBefore = false
    let disposed = false

    const broadcast = supabase
      .channel(LIVE_TOPIC)
      .on("broadcast", { event: LIVE_BROADCAST_EVENT }, ({ payload }) => receive(payload))
      .subscribe((state) => {
        if (disposed) return
        if (state === "SUBSCRIBED") {
          joined(!joinedBefore, Date.now() - startedAt)
          joinedBefore = true
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("degraded")
        }
      })

    // One channel per table: a table missing from the publication must not take the others down.
    const tableChannels = Object.keys(DB_TABLE_KEYS).map((table) =>
      supabase
        .channel(`db-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => tableChanged(table, rowOf(payload)))
        .subscribe()
    )

    // Persisted events double as a fallback transport when a broadcast is lost.
    const history = supabase
      .channel("db-activity_events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, (payload) =>
        receive(rowToLiveEvent(rowOf(payload)))
      )
      .subscribe()

    return () => {
      disposed = true
      supabase.removeChannel(broadcast)
      supabase.removeChannel(history)
      tableChannels.forEach((c) => supabase.removeChannel(c))
      queue.dispose()
    }
  }, [queue])

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
    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        return
      }
      announcer.welcomeBack()
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_RESYNC_MS) syncAll("visible")
      hiddenAt = 0
    }
    const onOnline = () => syncAll("online")
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onOnline)
    }
  }, [syncAll, announcer])

  useEffect(() => {
    if (!prefs.sound) return
    const prime = () => primeAudio()
    window.addEventListener("pointerdown", prime, { once: true })
    window.addEventListener("keydown", prime, { once: true })
    return () => {
      window.removeEventListener("pointerdown", prime)
      window.removeEventListener("keydown", prime)
    }
  }, [prefs.sound])

  const value = useMemo<LiveContextValue>(
    () => ({ status, feed, userId, subscribe, lastEventAt, clockOffset, resync }),
    [status, feed, userId, subscribe, lastEventAt, clockOffset, resync]
  )

  return (
    <LiveBusContext.Provider value={subscribe}>
      <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
    </LiveBusContext.Provider>
  )
}
