"use client"

import { useEffect } from "react"
import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DuelBoard, DuelRoster } from "@/lib/duels/types"
import type { SessionStatus } from "@/lib/types"

export class DuelRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message)
  }
}

export interface ClockedBoard extends DuelBoard {
  clockOffset: number
}

export const duelBoardKey = (sessionId: string, status: SessionStatus) => ["duels", "board", sessionId, status] as const
export const DUEL_ROSTER_KEY = ["duels", "roster"] as const

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init })
  const body = (await res.json().catch(() => null)) as (T & { error?: unknown; code?: unknown }) | null
  if (!res.ok || !body) {
    throw new DuelRequestError(
      typeof body?.error === "string" ? body.error : "The court is not answering. Try again.",
      res.status,
      typeof body?.code === "string" ? body.code : null
    )
  }
  return body
}

export function post<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

// Status is part of the key: every phase change refetches the board, which also runs the lazy expiry sweep.
export function useDuelBoard(sessionId: string, status: SessionStatus, enabled = true) {
  return useQuery({
    queryKey: duelBoardKey(sessionId, status),
    queryFn: async (): Promise<ClockedBoard> => {
      const board = await request<DuelBoard>(`/api/duels?sessionId=${encodeURIComponent(sessionId)}`)
      return { ...board, clockOffset: Date.now() - Date.parse(board.now) }
    },
    enabled,
    staleTime: 5_000,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.session.accepting ? 30_000 : false),
  })
}

const rosterQuery = queryOptions({
  queryKey: DUEL_ROSTER_KEY,
  queryFn: () => request<DuelRoster>("/api/duels/roster"),
  staleTime: 5 * 60_000,
})

export function useDuelRoster(enabled: boolean) {
  return useQuery({ ...rosterQuery, enabled })
}

// Warms the rival picker without observing it, so duel events do not refetch the roster while the sheet is shut.
export function usePrefetchDuelRoster(enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (enabled) void queryClient.prefetchQuery(rosterQuery)
  }, [enabled, queryClient])
}
