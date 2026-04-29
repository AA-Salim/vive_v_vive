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

  const playerStats = players.map((player) => {
    const totalGames = player.wins + player.losses
    const winRate = totalGames > 0 ? (player.wins / totalGames) * 100 : 0

    return {
      ...player,
      winRate: Math.round(winRate * 10) / 10,
    }
  })

  return NextResponse.json(playerStats)
}
