"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { EquippedTitle } from "@/lib/titles/types"

export const EQUIPPED_TITLES_KEY = ["titles", "equipped"] as const

export function useEquippedTitles() {
  const query = useQuery({
    queryKey: EQUIPPED_TITLES_KEY,
    queryFn: async (): Promise<EquippedTitle[]> => {
      const res = await fetch("/api/titles/equipped")
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 60_000,
  })

  const list = query.data
  return useMemo(() => {
    const equipped = list ?? []
    return {
      equipped,
      byPlayerId: new Map(equipped.filter((t) => t.playerId).map((t) => [t.playerId as string, t])),
      byUserId: new Map(equipped.map((t) => [t.userId, t])),
    }
  }, [list])
}
