import { createClient } from "@/lib/supabase"
import { computeDuos, DUO_MIN_GAMES } from "@/lib/pages/compute-pairs"
import { loadMatchData } from "@/lib/pages/matches"
import { seasonFromRequest } from "@/lib/pages/season"
import { json, scribeError } from "@/lib/pages/server"
import type { DuosResponse, PlayerRef } from "@/lib/pages/types"

export async function GET(request: Request) {
  const supabase = await createClient()
  try {
    const scope = await seasonFromRequest(supabase, request)
    if ("error" in scope) return scope.error
    const data = await loadMatchData(supabase, scope.window)
    const duos = computeDuos(data)
    const active = new Set(duos.flatMap((d) => [d.a, d.b]))
    const players: PlayerRef[] = [...data.players.values()]
      .filter((p) => active.has(p.id))
      .sort((x, y) => x.name.localeCompare(y.name))
    const body: DuosResponse = { players, duos, minGames: DUO_MIN_GAMES, season: scope.season }
    return json(body)
  } catch {
    return scribeError()
  }
}
