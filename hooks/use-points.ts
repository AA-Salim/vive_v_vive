"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { PointTransaction } from "@/lib/types"

interface PointsSnapshot {
  balance: number
  lastDailyClaim: string | null
  transactions: PointTransaction[]
}

const NO_TRANSACTIONS: PointTransaction[] = []

// POST /api/points/daily. amount, paid_to_salaxe and title_effects arrive with the title effects migration.
export interface DailyClaim {
  claimed?: boolean
  already_claimed?: boolean
  balance?: number
  amount?: number
  paid_to_salaxe?: boolean
  title_effects?: unknown
}

// Balance queries are ["points", userId, ...]: live events refresh only the affected user's balance.
export function pointsKey(userId: string | null | undefined) {
  return ["points", userId ?? "anonymous"] as const
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

  const setBalance = useCallback(
    (balance: unknown) => {
      if (typeof balance !== "number" || !userId) return
      queryClient.setQueryData<PointsSnapshot>(pointsKey(userId), (old) => (old ? { ...old, balance } : old))
    },
    [queryClient, userId]
  )

  const refresh = useCallback(async () => {
    if (!userId) return
    await queryClient.invalidateQueries({ queryKey: pointsKey(userId) })
  }, [queryClient, userId])

  const initialize = useCallback(async () => {
    const data = await postJson("/api/points/initialize")
    if (!data?.already_initialized) await refresh()
    return data
  }, [refresh])

  const claimDaily = useCallback(async (): Promise<DailyClaim | null> => {
    const data = (await postJson("/api/points/daily")) as DailyClaim | null
    if (data?.claimed) setBalance(data.balance)
    await refresh()
    return data
  }, [refresh, setBalance])

  return {
    balance: points.data?.balance ?? 0,
    lastDailyClaim: points.data?.lastDailyClaim ?? null,
    transactions: points.data?.transactions ?? NO_TRANSACTIONS,
    isLoading: enabled && points.isPending,
    refetch: refresh,
    initialize,
    claimDaily,
  }
}
