import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .order("wins", { ascending: false })

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 })
  }

  const { data: gamePlayers, error: gpError } = await supabase
    .from("game_players")
    .select("player_id, champion, lane")

  if (gpError) {
    return NextResponse.json({ error: gpError.message }, { status: 500 })
  }

  const playerStats = players.map((player) => {
    const playerGames = gamePlayers?.filter(
      (gp) => gp.player_id === player.id
    ) ?? []

    const champCounts: Record<string, number> = {}
    const laneCounts: Record<string, number> = {}

    for (const gp of playerGames) {
      champCounts[gp.champion] = (champCounts[gp.champion] || 0) + 1
      laneCounts[gp.lane] = (laneCounts[gp.lane] || 0) + 1
    }

    const mostPlayedChampion =
      Object.keys(champCounts).length > 0
        ? Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null

    const mostPlayedLane =
      Object.keys(laneCounts).length > 0
        ? Object.entries(laneCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null

    const totalGames = player.wins + player.losses
    const winRate = totalGames > 0 ? (player.wins / totalGames) * 100 : 0

    return {
      ...player,
      winRate: Math.round(winRate * 10) / 10,
      mostPlayedChampion,
      mostPlayedLane,
    }
  })

  return NextResponse.json(playerStats)
}
