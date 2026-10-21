import { createClient } from "./supabase"
import { CHAMPION_POOLS, type Champion } from "./champions"
import type { Role } from "./types"

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"]

export async function getChampionPools(): Promise<Record<Role, Champion[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("champion_roles").select("name, internal_name, role")
    if (error || !data || data.length === 0) return CHAMPION_POOLS

    const pools: Record<Role, Champion[]> = { top: [], jungle: [], mid: [], adc: [], support: [] }
    for (const row of data as { name: string; internal_name: string; role: string }[]) {
      if (ROLES.includes(row.role as Role)) pools[row.role as Role].push({ name: row.name, internal: row.internal_name })
    }
    return ROLES.every((role) => pools[role].length > 0) ? pools : CHAMPION_POOLS
  } catch {
    return CHAMPION_POOLS
  }
}
