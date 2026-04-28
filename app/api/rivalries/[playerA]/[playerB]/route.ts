import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import type { Side } from "@/lib/types"

interface GamePlayerRow {
  game_id: string
  player_id: string
  side: Side
  lane: string
  champion: string
  games: { winner_side: Side; played_at: string }
}

interface MatchupGame {
  game_id: string
  played_at: string
  winner_side: Side
  a_side: Side
  a_lane: string
  a_champion: string
  b_side: Side
  b_lane: string
  b_champion: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playerA: string; playerB: string }> }
) {
  const { playerA, playerB } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("game_players")
    .select("game_id, player_id, side, lane, champion, games!inner(winner_side, played_at)")
    .in("player_id", [playerA, playerB])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data as unknown as GamePlayerRow[]
  const gameGroups = new Map<string, GamePlayerRow[]>()

  for (const row of rows) {
    const group = gameGroups.get(row.game_id)
    if (group) {
      group.push(row)
    } else {
      gameGroups.set(row.game_id, [row])
    }
  }

  const games: MatchupGame[] = []

  for (const [gameId, players] of gameGroups) {
    if (players.length !== 2) continue

    const rowA = players.find((p) => p.player_id === playerA)
    const rowB = players.find((p) => p.player_id === playerB)

    if (!rowA || !rowB || rowA.side === rowB.side) continue

    games.push({
      game_id: gameId,
      played_at: rowA.games.played_at,
      winner_side: rowA.games.winner_side,
      a_side: rowA.side,
      a_lane: rowA.lane,
      a_champion: rowA.champion,
      b_side: rowB.side,
      b_lane: rowB.lane,
      b_champion: rowB.champion,
    })
  }

  games.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())

  return NextResponse.json({ games })
}
