"use client"

import { useEffect, useState, useCallback } from "react"
import type { PointTransaction } from "@/lib/types"

interface PointsState {
  balance: number
  lastDailyClaim: string | null
  transactions: PointTransaction[]
  kissToday: number
  kissRemaining: number
  totalKisses: number
  isLoading: boolean
}

export function usePoints(userId: string | null) {
  const [state, setState] = useState<PointsState>({
    balance: 0,
    lastDailyClaim: null,
    transactions: [],
    kissToday: 0,
    kissRemaining: 3,
    totalKisses: 0,
    isLoading: true,
  })

  const fetchPoints = useCallback(async () => {
    if (!userId) {
      setState({ balance: 0, lastDailyClaim: null, transactions: [], kissToday: 0, kissRemaining: 3, totalKisses: 0, isLoading: false })
      return
    }
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const [pointsRes, kissRes] = await Promise.all([
        fetch("/api/points"),
        fetch("/api/points/kiss"),
      ])
      if (!pointsRes.ok) {
        setState((prev) => ({ ...prev, isLoading: false }))
        return
      }
      const data = await pointsRes.json()
      const kissData = kissRes.ok ? await kissRes.json() : { used_today: 0, remaining_today: 3, total_kisses: 0 }
      setState({
        balance: data.balance,
        lastDailyClaim: data.last_daily_claim,
        transactions: data.transactions,
        kissToday: kissData.used_today,
        kissRemaining: kissData.remaining_today,
        totalKisses: kissData.total_kisses,
        isLoading: false,
      })
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [userId])

  useEffect(() => {
    fetchPoints()
    const timeout = setTimeout(() => {
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev))
    }, 5000)
    return () => clearTimeout(timeout)
  }, [fetchPoints])

  const initialize = useCallback(async () => {
    await fetch("/api/points/initialize", { method: "POST" })
    await fetchPoints()
  }, [fetchPoints])

  const claimDaily = useCallback(async () => {
    const res = await fetch("/api/points/daily", { method: "POST" })
    const data = await res.json()
    await fetchPoints()
    return data
  }, [fetchPoints])

  const kissTheHand = useCallback(async () => {
    const res = await fetch("/api/points/kiss", { method: "POST" })
    const data = await res.json()
    await fetchPoints()
    return data
  }, [fetchPoints])

  return {
    balance: state.balance,
    lastDailyClaim: state.lastDailyClaim,
    transactions: state.transactions,
    kissToday: state.kissToday,
    kissRemaining: state.kissRemaining,
    totalKisses: state.totalKisses,
    isLoading: state.isLoading,
    refetch: fetchPoints,
    initialize,
    claimDaily,
    kissTheHand,
  }
}
