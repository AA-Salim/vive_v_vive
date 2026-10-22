import { createClient } from "@/lib/supabase"
import { computeDuos, DUO_MIN_GAMES } from "@/lib/pages/compute-pairs"
import { loadMatchData } from "@/lib/pages/matches"
import { json, scribeError } from "@/lib/pages/server"
import type { DuosResponse, PlayerRef } from "@/lib/pages/types"

export async function GET() {
  const supabase = await createClient()
  try {
    const data = await loadMatchData(supabase)
    const duos = computeDuos(data)
    const active = new Set(duos.flatMap((d) => [d.a, d.b]))
    const players: PlayerRef[] = [...data.players.values()]
      .filter((p) => active.has(p.id))
      .sort((x, y) => x.name.localeCompare(y.name))
    const body: DuosResponse = { players, duos, minGames: DUO_MIN_GAMES }
    return json(body)
  } catch {
    return scribeError()
  }
}
