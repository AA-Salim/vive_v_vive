import { createClient } from "@/lib/supabase"
import { computeChampionStats } from "@/lib/pages/compute-champions"
import { json, loadMatchContext, scribeError } from "@/lib/pages/server"
import type { ChampionsResponse } from "@/lib/pages/types"

export async function GET() {
  const supabase = await createClient()
  try {
    const { data, internalOf, pools } = await loadMatchContext(supabase)
    const champions = computeChampionStats(data, internalOf)
    const pool = new Set(Object.values(pools).flatMap((list) => list.map((c) => c.internal))).size
    const body: ChampionsResponse = {
      totals: { picks: champions.reduce((sum, c) => sum + c.games, 0), unique: champions.length, pool },
      champions,
      pools,
    }
    return json(body)
  } catch {
    return scribeError()
  }
}
