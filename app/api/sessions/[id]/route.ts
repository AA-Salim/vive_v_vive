import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { assignChampions } from "@/lib/randomizer"
import type { Assignment, Player, Role, Side } from "@/lib/types"

const SESSION_SELECT = `
  *,
  session_assignments (
    *,
    players:player_id ( id, name )
  )
`

type ActionBody =
  | { action: "reroll" }
  | { action: "toggle_lock"; assignment_id: string }
  | { action: "start_game" }
  | { action: "close_betting" }
  | { action: "declare_winner"; winner_side: "blue" | "red" }
  | { action: "cancel" }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = (await request.json()) as ActionBody

  const { data: session, error: fetchError } = await supabase
    .from("game_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .single()

  if (fetchError || !session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (session.created_by && (!user || user.id !== session.created_by)) {
    return NextResponse.json(
      { error: "Only the session creator can perform this action" },
      { status: 403 }
    )
  }

  switch (body.action) {
    case "reroll":
      return handleReroll(supabase, session)
    case "toggle_lock":
      return handleToggleLock(supabase, session, body.assignment_id)
    case "start_game":
      return handleStartGame(supabase, session)
    case "close_betting":
      return handleCloseBetting(supabase, session)
    case "declare_winner":
      return handleDeclareWinner(supabase, session, body.winner_side)
    case "cancel":
      return handleCancel(supabase, session)
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleReroll(supabase: any, session: any) {
  if (session.status !== "draft") {
    return NextResponse.json(
      { error: "Can only reroll in draft" },
      { status: 400 }
    )
  }

  const assignments = session.session_assignments as Array<{
    id: string
    player_id: string
    side: Side
    lane: Role
    champion: string
    champion_internal: string
    locked: boolean
    fearless_override: boolean
    players: { id: string; name: string }
  }>

  const today = new Date().toISOString().split("T")[0]
  const { data: fearlessData } = await supabase
    .from("daily_fearless")
    .select("champion_name")
    .eq("date", today)

  const fearlessBanned = new Set<string>(
    fearlessData?.map((r: { champion_name: string }) => r.champion_name) ?? []
  )

  const lockedAssignments = new Map<string, Assignment>()
  for (const a of assignments) {
    if (a.locked) {
      lockedAssignments.set(a.player_id, {
        player: {
          id: a.players.id,
          name: a.players.name,
          is_active: true,
          wins: 0,
          losses: 0,
          games_played: 0,
          created_at: "",
        },
        side: a.side,
        lane: a.lane,
        champion: a.champion,
        championInternal: a.champion_internal,
        locked: true,
        fearlessOverride: a.fearless_override,
      })
    }
  }

  const blueTeam = assignments
    .filter((a) => a.side === "blue")
    .map((a) => ({
      player: {
        id: a.players.id,
        name: a.players.name,
        is_active: true,
        wins: 0,
        losses: 0,
        games_played: 0,
        created_at: "",
      } as Player,
      lane: a.lane,
    }))

  const redTeam = assignments
    .filter((a) => a.side === "red")
    .map((a) => ({
      player: {
        id: a.players.id,
        name: a.players.name,
        is_active: true,
        wins: 0,
        losses: 0,
        games_played: 0,
        created_at: "",
      } as Player,
      lane: a.lane,
    }))

  const newAssignments = assignChampions(
    blueTeam,
    redTeam,
    fearlessBanned,
    lockedAssignments
  )

  const unlocked = assignments.filter((a) => !a.locked).map((a) => a.id)
  if (unlocked.length > 0) {
    await supabase
      .from("session_assignments")
      .delete()
      .in("id", unlocked)
  }

  const newRows = newAssignments
    .filter((a) => !a.locked)
    .map((a) => ({
      session_id: session.id,
      player_id: a.player.id,
      side: a.side,
      lane: a.lane,
      champion: a.champion,
      champion_internal: a.championInternal,
      locked: false,
      fearless_override: a.fearlessOverride,
    }))

  if (newRows.length > 0) {
    const { error } = await supabase
      .from("session_assignments")
      .insert(newRows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await supabase
    .from("game_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", session.id)

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleToggleLock(supabase: any, session: any, assignmentId: string) {
  if (session.status !== "draft") {
    return NextResponse.json(
      { error: "Can only lock in draft" },
      { status: 400 }
    )
  }

  const assignment = session.session_assignments.find(
    (a: { id: string }) => a.id === assignmentId
  )
  if (!assignment) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from("session_assignments")
    .update({ locked: !assignment.locked })
    .eq("id", assignmentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStartGame(supabase: any, session: any) {
  if (session.status !== "draft") {
    return NextResponse.json(
      { error: "Can only start game from draft" },
      { status: 400 }
    )
  }

  const bettingEndsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from("game_sessions")
    .update({
      status: "betting",
      betting_ends_at: bettingEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCloseBetting(supabase: any, session: any) {
  if (session.status !== "betting") {
    return NextResponse.json(
      { error: "Can only close betting during betting phase" },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("game_sessions")
    .update({
      status: "in_game",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDeclareWinner(supabase: any, session: any, winnerSide: "blue" | "red") {
  if (session.status !== "in_game") {
    return NextResponse.json(
      { error: "Can only declare winner during in_game" },
      { status: 400 }
    )
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({ winner_side: winnerSide })
    .select()
    .single()

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  const assignments = session.session_assignments as Array<{
    player_id: string
    side: string
    lane: string
    champion: string
    players: { id: string; name: string }
  }>

  const gamePlayers = assignments.map((a) => ({
    game_id: game.id,
    player_id: a.player_id,
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

  const champions = [...new Set(assignments.map((a) => a.champion))]
  const today = new Date().toISOString().split("T")[0]
  const fearlessRows = champions.map((champion_name) => ({
    champion_name,
    date: today,
  }))

  await supabase.from("daily_fearless").upsert(fearlessRows, {
    onConflict: "date,champion_name",
  })

  const winnerIds = assignments
    .filter((a) => a.side === winnerSide)
    .map((a) => a.player_id)
  const loserIds = assignments
    .filter((a) => a.side !== winnerSide)
    .map((a) => a.player_id)

  for (const pid of winnerIds) {
    const { data: p } = await supabase
      .from("players")
      .select("wins, games_played")
      .eq("id", pid)
      .single()
    if (p) {
      await supabase
        .from("players")
        .update({ wins: p.wins + 1, games_played: p.games_played + 1 })
        .eq("id", pid)
    }
  }

  for (const pid of loserIds) {
    const { data: p } = await supabase
      .from("players")
      .select("losses, games_played")
      .eq("id", pid)
      .single()
    if (p) {
      await supabase
        .from("players")
        .update({ losses: p.losses + 1, games_played: p.games_played + 1 })
        .eq("id", pid)
    }
  }

  for (const pid of winnerIds) {
    const { data: player } = await supabase
      .from("players")
      .select("auth_user_id")
      .eq("id", pid)
      .single()
    if (player?.auth_user_id) {
      await supabase.rpc("adjust_balance", {
        p_user_id: player.auth_user_id,
        p_amount: 10,
        p_reason: "game_win",
        p_reference_id: session.id,
      })
    }
  }

  for (const pid of loserIds) {
    const { data: player } = await supabase
      .from("players")
      .select("auth_user_id")
      .eq("id", pid)
      .single()
    if (player?.auth_user_id) {
      await supabase.rpc("adjust_balance", {
        p_user_id: player.auth_user_id,
        p_amount: 2,
        p_reason: "game_participation",
        p_reference_id: session.id,
      })
    }
  }

  await supabase.rpc("resolve_bets", {
    p_session_id: session.id,
    p_winner_side: winnerSide,
  })

  const { error: updateError } = await supabase
    .from("game_sessions")
    .update({
      status: winnerSide === "blue" ? "blue_win" : "red_win",
      game_id: game.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    )
  }

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCancel(supabase: any, session: any) {
  if (!["draft", "betting", "in_game"].includes(session.status)) {
    return NextResponse.json(
      { error: "Session is already resolved" },
      { status: 400 }
    )
  }

  await supabase.rpc("refund_all_bets", {
    p_session_id: session.id,
  })

  const { error } = await supabase
    .from("game_sessions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return returnSession(supabase, session.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function returnSession(supabase: any, sessionId: string) {
  const { data, error } = await supabase
    .from("game_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, {
    headers: { "x-server-time": new Date().toISOString() },
  })
}
