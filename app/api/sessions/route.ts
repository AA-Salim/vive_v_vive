import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { splitTeams, assignLanes, assignChampions } from "@/lib/randomizer"
import { getChampionPools } from "@/lib/champions-db"
import type { Player } from "@/lib/types"

const SESSION_SELECT = `
  *,
  session_assignments (
    *,
    players:player_id ( id, name )
  )
`

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("game_sessions")
    .select(SESSION_SELECT)
    .in("status", ["draft", "chaos", "betting", "in_game"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, {
    headers: { "x-server-time": new Date().toISOString() },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { player_ids } = (await request.json()) as { player_ids: string[] }

  if (!player_ids || player_ids.length !== 10) {
    return NextResponse.json(
      { error: "Exactly 10 player IDs required" },
      { status: 400 }
    )
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, is_active, wins, losses, games_played, created_at")
    .in("id", player_ids)

  if (playersError || !players || players.length !== 10) {
    return NextResponse.json(
      { error: "Could not fetch all 10 players" },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().split("T")[0]
  const { data: fearlessData } = await supabase
    .from("daily_fearless")
    .select("champion_name")
    .eq("date", today)

  const fearlessBanned = new Set(
    fearlessData?.map((r) => r.champion_name) ?? []
  )

  const championPools = await getChampionPools()

  const { blue, red } = splitTeams(players as Player[])
  const blueWithLanes = assignLanes(blue)
  const redWithLanes = assignLanes(red)
  const assignments = assignChampions(
    blueWithLanes,
    redWithLanes,
    fearlessBanned,
    new Map(),
    championPools
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Login required to create a session" },
      { status: 401 }
    )
  }

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({ status: "draft", created_by: user.id })
    .select()
    .single()

  if (sessionError) {
    if (sessionError.code === "23505") {
      return NextResponse.json(
        { error: "An active session already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: sessionError.message },
      { status: 500 }
    )
  }

  const rows = assignments.map((a) => ({
    session_id: session.id,
    player_id: a.player.id,
    side: a.side,
    lane: a.lane,
    champion: a.champion,
    champion_internal: a.championInternal,
    locked: false,
    fearless_override: a.fearlessOverride,
  }))

  const { error: assignError } = await supabase
    .from("session_assignments")
    .insert(rows)

  if (assignError) {
    await supabase.from("game_sessions").delete().eq("id", session.id)
    return NextResponse.json(
      { error: assignError.message },
      { status: 500 }
    )
  }

  const { data: full } = await supabase
    .from("game_sessions")
    .select(SESSION_SELECT)
    .eq("id", session.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
