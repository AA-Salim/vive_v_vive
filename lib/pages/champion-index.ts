import { CHAMPION_POOLS, type Champion } from "@/lib/champions"
import type { Role } from "@/lib/types"

export type ChampionLookup = (name: string) => string | null

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "")

// game_players stores display names; portraits need Data Dragon ids. The database pools win over the bundled list.
export function buildChampionIndex(pools?: Record<Role, Champion[]> | null): ChampionLookup {
  const index = new Map<string, string>()
  const add = (champion: Champion) => {
    for (const key of [normalize(champion.name), normalize(champion.internal)]) {
      if (key && !index.has(key)) index.set(key, champion.internal)
    }
  }
  for (const source of [pools, CHAMPION_POOLS]) {
    if (!source) continue
    for (const list of Object.values(source)) list.forEach(add)
  }
  return (name: string) => index.get(normalize(name)) ?? null
}
