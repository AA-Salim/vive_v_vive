import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import type { Side } from "@/lib/types"

interface GamePlayerRow {
  game_id: string
  player_id: string
  side: Side
  lane: string
  champion: string
  games: { winner_side: Side }
}

interface Rivalry {
  player_a: string
  player_b: string
  total_games: number
  a_wins: number
  b_wins: number
  lane_duels: number
  a_lane_wins: number
  b_lane_wins: number
}

export async function GET() {
  const supabase = await createClient()

  const [gpResult, playersResult] = await Promise.all([
    supabase
      .from("game_players")
      .select("game_id, player_id, side, lane, champion, games!inner(winner_side)"),
    supabase.from("players").select("id, name").order("name"),
  ])

  if (gpResult.error) {
    return NextResponse.json({ error: gpResult.error.message }, { status: 500 })
  }
  if (playersResult.error) {
    return NextResponse.json({ error: playersResult.error.message }, { status: 500 })
  }

  const rows = gpResult.data as unknown as GamePlayerRow[]
  const gameGroups = new Map<string, GamePlayerRow[]>()

  for (const row of rows) {
    const group = gameGroups.get(row.game_id)
    if (group) {
      group.push(row)
    } else {
      gameGroups.set(row.game_id, [row])
    }
  }

  const pairMap = new Map<string, Rivalry>()

  for (const players of gameGroups.values()) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i]
        const b = players[j]

        if (a.side === b.side) continue

        const [pA, pB] = a.player_id < b.player_id ? [a, b] : [b, a]
        const key = `${pA.player_id}:${pB.player_id}`
        const winnerSide = pA.games.winner_side
        const isLaneDuel = pA.lane === pB.lane

        let rivalry = pairMap.get(key)
        if (!rivalry) {
          rivalry = {
            player_a: pA.player_id,
            player_b: pB.player_id,
            total_games: 0,
            a_wins: 0,
            b_wins: 0,
            lane_duels: 0,
            a_lane_wins: 0,
            b_lane_wins: 0,
          }
          pairMap.set(key, rivalry)
        }

        rivalry.total_games++
        if (winnerSide === pA.side) {
          rivalry.a_wins++
        } else {
          rivalry.b_wins++
        }

        if (isLaneDuel) {
          rivalry.lane_duels++
          if (winnerSide === pA.side) {
            rivalry.a_lane_wins++
          } else {
            rivalry.b_lane_wins++
          }
        }
      }
    }
  }

  const rivalries = Array.from(pairMap.values()).sort((a, b) => {
    if (b.lane_duels !== a.lane_duels) return b.lane_duels - a.lane_duels
    return b.total_games - a.total_games
  })

  return NextResponse.json({
    players: playersResult.data,
    rivalries,
  })
}
