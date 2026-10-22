"use client"

import { useQuery } from "@tanstack/react-query"
import { TITLE_RULES_HEADER, parseTitleRules, setTitleRulesVersion } from "@/lib/titles/rules-version"
import type { EquippedTitle, LoadoutEntry } from "@/lib/titles/types"

export const EQUIPPED_TITLES_KEY = ["titles", "equipped"] as const

// Every entry describes its primary title at the top level and its whole loadout in `loadout`.
export interface EquippedIndex {
  equipped: EquippedTitle[]
  byPlayerId: Map<string, EquippedTitle>
  byUserId: Map<string, EquippedTitle>
  loadoutByUserId: Map<string, LoadoutEntry[]>
  entryFor: (playerId?: string | null, userId?: string | null) => EquippedTitle | undefined
}

const EMPTY: EquippedTitle[] = []
const INDEXES = new WeakMap<EquippedTitle[], EquippedIndex>()

// Every name on screen reads the same list: the maps are built once per response, not once per row.
function indexOf(list: EquippedTitle[]): EquippedIndex {
  const cached = INDEXES.get(list)
  if (cached) return cached
  const byPlayerId = new Map(list.filter((t) => t.playerId).map((t) => [t.playerId as string, t]))
  const byUserId = new Map(list.map((t) => [t.userId, t]))
  const index: EquippedIndex = {
    equipped: list,
    byPlayerId,
    byUserId,
    loadoutByUserId: new Map(list.map((t) => [t.userId, t.loadout ?? []])),
    entryFor: (playerId, userId) => (playerId ? byPlayerId.get(playerId) : undefined) ?? (userId ? byUserId.get(userId) : undefined),
  }
  INDEXES.set(list, index)
  return index
}

export function useEquippedTitles(): EquippedIndex {
  const query = useQuery({
    queryKey: EQUIPPED_TITLES_KEY,
    queryFn: async (): Promise<EquippedTitle[]> => {
      const res = await fetch("/api/titles/equipped")
      if (!res.ok) return []
      setTitleRulesVersion(parseTitleRules(res.headers.get(TITLE_RULES_HEADER)))
      const body: unknown = await res.json()
      return Array.isArray(body) ? (body as EquippedTitle[]) : []
    },
    staleTime: 60_000,
  })
  return indexOf(query.data ?? EMPTY)
}
