import { createClient } from "@/lib/supabase"
import { computeRivalries } from "@/lib/pages/compute-pairs"
import { loadMatchData } from "@/lib/pages/matches"
import { seasonFromRequest } from "@/lib/pages/season"
import { json, scribeError } from "@/lib/pages/server"
import type { PlayerRef, RivalriesResponse } from "@/lib/pages/types"

export async function GET(request: Request) {
  const supabase = await createClient()
  try {
    const scope = await seasonFromRequest(supabase, request)
    if ("error" in scope) return scope.error
    const data = await loadMatchData(supabase, scope.window)
    const rivalries = computeRivalries(data)
    const active = new Set(rivalries.flatMap((r) => [r.a, r.b]))
    const players: PlayerRef[] = [...data.players.values()]
      .filter((p) => active.has(p.id))
      .sort((x, y) => x.name.localeCompare(y.name))
    const body: RivalriesResponse = { players, rivalries, season: scope.season }
    return json(body)
  } catch {
    return scribeError()
  }
}
