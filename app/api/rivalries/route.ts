import { createClient } from "@/lib/supabase"
import { computeRivalries } from "@/lib/pages/compute-pairs"
import { loadMatchData } from "@/lib/pages/matches"
import { json, scribeError } from "@/lib/pages/server"
import type { PlayerRef, RivalriesResponse } from "@/lib/pages/types"

export async function GET() {
  const supabase = await createClient()
  try {
    const data = await loadMatchData(supabase)
    const rivalries = computeRivalries(data)
    const active = new Set(rivalries.flatMap((r) => [r.a, r.b]))
    const players: PlayerRef[] = [...data.players.values()]
      .filter((p) => active.has(p.id))
      .sort((x, y) => x.name.localeCompare(y.name))
    const body: RivalriesResponse = { players, rivalries }
    return json(body)
  } catch {
    return scribeError()
  }
}
