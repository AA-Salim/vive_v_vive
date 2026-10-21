"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { PointTransaction } from "@/lib/types"

interface PointsSnapshot {
  balance: number
  lastDailyClaim: string | null
  transactions: PointTransaction[]
}

interface KissSnapshot {
  kissToday: number
  kissRemaining: number
  totalKisses: number
}

const DAILY_KISSES = 3
const NO_TRANSACTIONS: PointTransaction[] = []
const DEFAULT_KISS: KissSnapshot = { kissToday: 0, kissRemaining: DAILY_KISSES, totalKisses: 0 }

// Balance queries are ["points", userId, ...]: live events refresh only the affected user's balance.
export function pointsKey(userId: string | null | undefined) {
  return ["points", userId ?? "anonymous"] as const
}

export function kissKey(userId: string | null | undefined) {
  return ["praise", "kiss", userId ?? "anonymous"] as const
}

const asNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

async function fetchPoints(signal: AbortSignal): Promise<PointsSnapshot> {
  const res = await fetch("/api/points", { signal, cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/points failed with ${res.status}`)
  const data = (await res.json()) as { balance?: number; last_daily_claim?: string | null; transactions?: PointTransaction[] }
  return {
    balance: asNumber(data.balance, 0),
    lastDailyClaim: data.last_daily_claim ?? null,
    transactions: Array.isArray(data.transactions) ? data.transactions : NO_TRANSACTIONS,
  }
}

async function fetchKiss(signal: AbortSignal): Promise<KissSnapshot> {
  const res = await fetch("/api/points/kiss", { signal, cache: "no-store" })
  if (!res.ok) return DEFAULT_KISS
  const data = (await res.json()) as { used_today?: number; remaining_today?: number; total_kisses?: number }
  return {
    kissToday: asNumber(data.used_today, 0),
    kissRemaining: asNumber(data.remaining_today, DAILY_KISSES),
    totalKisses: asNumber(data.total_kisses, 0),
  }
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res.json().catch(() => null)
}

export function usePoints(userId: string | null) {
  const queryClient = useQueryClient()
  const enabled = !!userId

  const points = useQuery({
    queryKey: pointsKey(userId),
    queryFn: ({ signal }) => fetchPoints(signal),
    enabled,
    staleTime: 15_000,
  })

  const kiss = useQuery({
    queryKey: kissKey(userId),
    queryFn: ({ signal }) => fetchKiss(signal),
    enabled,
    staleTime: 60_000,
  })

  const setBalance = useCallback(
    (balance: unknown) => {
      if (typeof balance !== "number" || !userId) return
      queryClient.setQueryData<PointsSnapshot>(pointsKey(userId), (old) => (old ? { ...old, balance } : old))
    },
    [queryClient, userId]
  )

  const refresh = useCallback(async () => {
    if (!userId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pointsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: kissKey(userId) }),
    ])
  }, [queryClient, userId])

  const initialize = useCallback(async () => {
    const data = await postJson("/api/points/initialize")
    if (!data?.already_initialized) await refresh()
    return data
  }, [refresh])

  const claimDaily = useCallback(async () => {
    const data = await postJson("/api/points/daily")
    if (data?.claimed) setBalance(data.balance)
    await refresh()
    return data
  }, [refresh, setBalance])

  // The optional body is forwarded as JSON (e.g. a written praise).
  const kissTheHand = useCallback(
    async (body?: Record<string, unknown>) => {
      const data = await postJson("/api/points/kiss", body)
      if (data && typeof data === "object") {
        setBalance(data.balance)
        if (typeof data.remaining_today === "number" && userId) {
          queryClient.setQueryData<KissSnapshot>(kissKey(userId), (old) => {
            const base = old ?? DEFAULT_KISS
            const used = data.kissed ? base.kissToday + 1 : base.kissToday
            return {
              kissToday: used,
              kissRemaining: data.remaining_today,
              totalKisses: data.kissed ? base.totalKisses + 1 : base.totalKisses,
            }
          })
        }
      }
      await refresh()
      return data
    },
    [queryClient, refresh, setBalance, userId]
  )

  const kissData = kiss.data ?? DEFAULT_KISS

  return {
    balance: points.data?.balance ?? 0,
    lastDailyClaim: points.data?.lastDailyClaim ?? null,
    transactions: points.data?.transactions ?? NO_TRANSACTIONS,
    kissToday: kissData.kissToday,
    kissRemaining: kissData.kissRemaining,
    totalKisses: kissData.totalKisses,
    isLoading: enabled && points.isPending,
    refetch: refresh,
    initialize,
    claimDaily,
    kissTheHand,
  }
}
