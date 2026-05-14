import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { assignChampions } from "@/lib/randomizer"
import { getChampionPools } from "@/lib/champions-db"
import type { Player, Role, Side } from "@/lib/types"

const SERPENTINE_ORDER: Side[] = [
  "blue", "red", "red", "blue", "blue",
  "red", "red", "blue", "blue", "red",
]

const SESSION_SELECT = `
  *,
  session_assignments (
    *,
    players:player_id ( id, name )
  )
`

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: picks, error } = await supabase
    .from("coach_draft_picks")
    .select("*, players:player_id ( id, name )")
    .eq("session_id", id)
    .order("pick_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(picks)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 })
  }

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.status !== "coach_draft") {
    return NextResponse.json(
      { error: "Session is not in coach_draft status" },
      { status: 400 }
    )
  }

  const { data: picks } = await supabase
    .from("coach_draft_picks")
    .select("*")
    .eq("session_id", id)
    .order("pick_number", { ascending: true })

  const currentPicks = picks || []

  switch (body.action) {
    case "pick": {
      if (currentPicks.length >= 10) {
        return NextResponse.json(
          { error: "All 10 picks already made" },
          { status: 400 }
        )
      }

      const pickNumber = currentPicks.length + 1
      const expectedSide = SERPENTINE_ORDER[pickNumber - 1]
      const isBlueCoach = user.id === session.blue_coach_id
      const isRedCoach = user.id === session.red_coach_id

      if (expectedSide === "blue" && !isBlueCoach) {
        return NextResponse.json(
          { error: "It's blue coach's turn to pick" },
          { status: 403 }
        )
      }
      if (expectedSide === "red" && !isRedCoach) {
        return NextResponse.json(
          { error: "It's red coach's turn to pick" },
          { status: 403 }
        )
      }

      const alreadyPicked = currentPicks.map((p) => p.player_id)
      if (alreadyPicked.includes(body.player_id)) {
        return NextResponse.json(
          { error: "Player already picked" },
          { status: 400 }
        )
      }

      const { data: player } = await supabase
        .from("players")
        .select("id, is_active")
        .eq("id", body.player_id)
        .single()

      if (!player || !player.is_active) {
        return NextResponse.json(
          { error: "Player not found or inactive" },
          { status: 400 }
        )
      }

      const { error: insertError } = await supabase
        .from("coach_draft_picks")
        .insert({
          session_id: id,
          pick_number: pickNumber,
          player_id: body.player_id,
          side: expectedSide,
        })

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      const nextPick = pickNumber + 1
      const nextTurn = nextPick <= 10 ? SERPENTINE_ORDER[nextPick - 1] : null

      await supabase
        .from("game_sessions")
        .update({
          draft_turn: nextTurn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      return NextResponse.json({ success: true, pick_number: pickNumber })
    }

    case "assign_lane": {
      if (currentPicks.length < 10) {
        return NextResponse.json(
          { error: "All 10 picks must be made before assigning lanes" },
          { status: 400 }
        )
      }

      const pick = currentPicks.find((p) => p.player_id === body.player_id)
      if (!pick) {
        return NextResponse.json(
          { error: "Player not found in draft picks" },
          { status: 400 }
        )
      }

      const isCoachForSide =
        (pick.side === "blue" && user.id === session.blue_coach_id) ||
        (pick.side === "red" && user.id === session.red_coach_id)

      if (!isCoachForSide) {
        return NextResponse.json(
          { error: "You can only assign lanes to your own team" },
          { status: 403 }
        )
      }

      const validLanes: Role[] = ["top", "jungle", "mid", "adc", "support"]
      if (!validLanes.includes(body.lane)) {
        return NextResponse.json(
          { error: "Invalid lane" },
          { status: 400 }
        )
      }

      const teamPicks = currentPicks.filter((p) => p.side === pick.side)
      const laneConflict = teamPicks.find(
        (p) => p.lane === body.lane && p.player_id !== body.player_id
      )
      if (laneConflict) {
        return NextResponse.json(
          { error: `Lane ${body.lane} already assigned to another player` },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from("coach_draft_picks")
        .update({ lane: body.lane })
        .eq("id", pick.id)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    case "confirm": {
      if (currentPicks.length < 10) {
        return NextResponse.json(
          { error: "All 10 picks must be made first" },
          { status: 400 }
        )
      }

      const unassigned = currentPicks.filter((p) => !p.lane)
      if (unassigned.length > 0) {
        return NextResponse.json(
          { error: `${unassigned.length} player(s) still need lane assignments` },
          { status: 400 }
        )
      }

      const isCoach =
        user.id === session.blue_coach_id || user.id === session.red_coach_id
      if (!isCoach) {
        return NextResponse.json(
          { error: "Only coaches can confirm the draft" },
          { status: 403 }
        )
      }

      const playerIds = currentPicks.map((p) => p.player_id)
      const { data: players } = await supabase
        .from("players")
        .select("id, name, is_active, wins, losses, games_played, created_at")
        .in("id", playerIds)

      if (!players || players.length !== 10) {
        return NextResponse.json(
          { error: "Could not fetch all players" },
          { status: 500 }
        )
      }

      const playerMap = new Map(players.map((p) => [p.id, p]))

      const bluePicks = currentPicks.filter((p) => p.side === "blue")
      const redPicks = currentPicks.filter((p) => p.side === "red")

      const blueTeam = bluePicks.map((p) => ({
        player: playerMap.get(p.player_id) as Player,
        lane: p.lane as Role,
      }))
      const redTeam = redPicks.map((p) => ({
        player: playerMap.get(p.player_id) as Player,
        lane: p.lane as Role,
      }))

      const today = new Date().toISOString().split("T")[0]
      const { data: fearlessData } = await supabase
        .from("daily_fearless")
        .select("champion_name")
        .eq("date", today)

      const fearlessBanned = new Set(
        fearlessData?.map((r) => r.champion_name) ?? []
      )

      const championPools = await getChampionPools()

      const assignments = assignChampions(
        blueTeam,
        redTeam,
        fearlessBanned,
        new Map(),
        championPools
      )

      const rows = assignments.map((a) => ({
        session_id: id,
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
        return NextResponse.json(
          { error: assignError.message },
          { status: 500 }
        )
      }

      await supabase
        .from("game_sessions")
        .update({
          status: "draft",
          draft_turn: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      const { data: full } = await supabase
        .from("game_sessions")
        .select(SESSION_SELECT)
        .eq("id", session.id)
        .single()

      return NextResponse.json(full)
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${body.action}` },
        { status: 400 }
      )
  }
}
