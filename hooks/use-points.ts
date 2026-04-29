"use client"

import { useEffect, useState, useCallback } from "react"
import type { PointTransaction } from "@/lib/types"

interface PointsState {
  balance: number
  lastDailyClaim: string | null
  transactions: PointTransaction[]
  isLoading: boolean
}

export function usePoints(userId: string | null) {
  const [state, setState] = useState<PointsState>({
    balance: 0,
    lastDailyClaim: null,
    transactions: [],
    isLoading: true,
  })

  const fetchPoints = useCallback(async () => {
    if (!userId) {
      setState({ balance: 0, lastDailyClaim: null, transactions: [], isLoading: false })
      return
    }
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const res = await fetch("/api/points")
      if (!res.ok) {
        setState((prev) => ({ ...prev, isLoading: false }))
        return
      }
      const data = await res.json()
      setState({
        balance: data.balance,
        lastDailyClaim: data.last_daily_claim,
        transactions: data.transactions,
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

  return {
    balance: state.balance,
    lastDailyClaim: state.lastDailyClaim,
    transactions: state.transactions,
    isLoading: state.isLoading,
    refetch: fetchPoints,
    initialize,
    claimDaily,
  }
}
