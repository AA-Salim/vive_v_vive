import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("games")
    .select(
      `
      *,
      game_players (
        *,
        players:player_id ( id, name )
      )
    `
    )
    .order("played_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

interface AssignmentPayload {
  player: { id: string }
  side: string
  lane: string
  champion: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { winner_side, assignments } = (await request.json()) as {
    winner_side: string
    assignments: AssignmentPayload[]
  }

  if (!winner_side || !assignments || assignments.length !== 10) {
    return NextResponse.json({ error: "Invalid game data" }, { status: 400 })
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({ winner_side })
    .select()
    .single()

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  const gamePlayers = assignments.map((a) => ({
    game_id: game.id,
    player_id: a.player.id,
    side: a.side,
    lane: a.lane,
    champion: a.champion,
  }))

  const { error: gpError } = await supabase
    .from("game_players")
    .insert(gamePlayers)

  if (gpError) {
    return NextResponse.json({ error: gpError.message }, { status: 500 })
  }

  const champions = [
    ...new Set(assignments.map((a) => a.champion)),
  ]
  const today = new Date().toISOString().split("T")[0]
  const fearlessRows = champions.map((champion_name) => ({
    champion_name,
    date: today,
  }))

  await supabase.from("daily_fearless").upsert(fearlessRows, {
    onConflict: "date,champion_name",
  })

  const winnerIds = assignments
    .filter((a) => a.side === winner_side)
    .map((a) => a.player.id)
  const loserIds = assignments
    .filter((a) => a.side !== winner_side)
    .map((a) => a.player.id)

  for (const id of winnerIds) {
    const { data: p } = await supabase
      .from("players")
      .select("wins, games_played")
      .eq("id", id)
      .single()
    if (p) {
      await supabase
        .from("players")
        .update({
          wins: p.wins + 1,
          games_played: p.games_played + 1,
        })
        .eq("id", id)
    }
  }

  for (const id of loserIds) {
    const { data: p } = await supabase
      .from("players")
      .select("losses, games_played")
      .eq("id", id)
      .single()
    if (p) {
      await supabase
        .from("players")
        .update({
          losses: p.losses + 1,
          games_played: p.games_played + 1,
        })
        .eq("id", id)
    }
  }

  return NextResponse.json(game, { status: 201 })
}
