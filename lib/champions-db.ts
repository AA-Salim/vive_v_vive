import { createClient } from "./supabase"
import { CHAMPION_POOLS, type Champion } from "./champions"
import type { Role } from "./types"

export async function getChampionPools(): Promise<Record<Role, Champion[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("champion_roles")
      .select("name, internal_name, role")

    if (error || !data || data.length === 0) {
      return CHAMPION_POOLS
    }

    const pools: Record<Role, Champion[]> = {
      top: [],
      jungle: [],
      mid: [],
      adc: [],
      support: []
    }

    data.forEach((row) => {
      pools[row.role as Role].push({
        name: row.name,
        internal: row.internal_name
      })
    })

    return pools
  } catch (e) {
    console.error("Error fetching champion pools:", e)
    return CHAMPION_POOLS
  }
}
