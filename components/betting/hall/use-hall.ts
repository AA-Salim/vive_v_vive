"use client"

import { useQuery } from "@tanstack/react-query"
import type { HallOfFame, HallScope } from "@/lib/betting/types"

export function useHall(scope: HallScope) {
  return useQuery({
    queryKey: ["bets", "hall", scope],
    queryFn: async (): Promise<HallOfFame> => {
      const res = await fetch(`/api/bets?scope=${scope}`, { cache: "no-store" })
      if (!res.ok) throw new Error("The hall is closed for repairs.")
      return res.json()
    },
    staleTime: 15_000,
  })
}

export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}
