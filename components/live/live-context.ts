"use client"

import { createContext, useContext, useEffect, useEffectEvent, useRef } from "react"
import { domainOf, type LiveDomain, type LiveEvent } from "@/lib/live/events"

export type LiveStatus = "connecting" | "live" | "degraded"
export type LiveSyncReason = "visible" | "online" | "poll" | "reconnect" | "manual"

export type LiveSignal =
  | { kind: "event"; event: LiveEvent }
  | { kind: "db"; table: string }
  | { kind: "sync"; reason: LiveSyncReason }

export type LiveListener = (signal: LiveSignal) => void
export type LiveSubscribe = (listener: LiveListener) => () => void

export interface LiveContextValue {
  status: LiveStatus
  feed: LiveEvent[]
  userId: string | null
  subscribe: LiveSubscribe
  // Client time of the last event received, for "last news" displays.
  lastEventAt: number | null
  // serverTimeDelta rounded to seconds: subtract it from Date.now() to compare with server timestamps.
  clockOffset: number
  resync: () => void
}

export const LiveContext = createContext<LiveContextValue | null>(null)
export const LiveBusContext = createContext<LiveSubscribe | null>(null)

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext)
  if (!ctx) throw new Error("useLive must be used inside LiveProvider")
  return ctx
}

// Subscribes to raw live signals without re-rendering on every feed update.
export function useLiveSignal(handler: LiveListener) {
  const subscribe = useContext(LiveBusContext)
  if (!subscribe) throw new Error("useLiveSignal must be used inside LiveProvider")
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
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
}
