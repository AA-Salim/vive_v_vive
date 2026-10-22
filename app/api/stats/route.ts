import { createClient } from "@/lib/supabase"
import { computePlayerStats, computeRecords } from "@/lib/pages/compute-players"
import { json, loadMatchContext, scribeError } from "@/lib/pages/server"
import type { StatsResponse } from "@/lib/pages/types"

export async function GET() {
  const supabase = await createClient()
  try {
    const { data, internalOf } = await loadMatchContext(supabase)
    const players = computePlayerStats(data, internalOf).sort(
      (x, y) => y.wins - x.wins || y.winRate - x.winRate || x.name.localeCompare(y.name)
    )
    const blueWins = data.matches.filter((m) => m.winner === "blue").length
    const body: StatsResponse = {
      totals: {
        games: data.matches.length,
        players: players.length,
        blueWins,
        redWins: data.matches.length - blueWins,
        firstGameAt: data.matches[0]?.playedAt ?? null,
        lastGameAt: data.matches[data.matches.length - 1]?.playedAt ?? null,
      },
      players,
      records: computeRecords(players),
    }
    return json(body)
  } catch {
    return scribeError()
  }
}
