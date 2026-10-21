"use client"

import { useQuery } from "@tanstack/react-query"
import type { EquippedTitle } from "@/app/api/titles/equipped/route"

export function useEquippedTitles() {
  const query = useQuery({
    queryKey: ["titles", "equipped"],
    queryFn: async (): Promise<EquippedTitle[]> => {
      const res = await fetch("/api/titles/equipped")
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 60_000,
  })

  const list = query.data ?? []
  return {
    equipped: list,
    byPlayerId: new Map(list.filter((t) => t.playerId).map((t) => [t.playerId as string, t])),
    byUserId: new Map(list.map((t) => [t.userId, t])),
  }
}
