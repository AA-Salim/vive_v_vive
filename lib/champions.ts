import type { Role } from "./types"
import championData from "./champions.json"

export interface Champion {
  name: string
  internal: string
}

export const CHAMPION_POOLS: Record<Role, Champion[]> = championData as Record<Role, Champion[]>

const DDRAGON_VERSION = "14.24.1"

export function getChampionImageUrl(internalName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${internalName}.png`
}

export function findChampion(name: string): Champion | undefined {
  for (const pool of Object.values(CHAMPION_POOLS)) {
    const found = pool.find((ch) => ch.name === name || ch.internal === name)
    if (found) return found
  }
  return undefined
}

export const ALL_ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"]

export const ROLE_LABELS: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support",
}
