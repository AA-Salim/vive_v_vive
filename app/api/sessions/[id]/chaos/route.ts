import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { assignChampions } from "@/lib/randomizer"
import type { Assignment, Player, Role, Side } from "@/lib/types"

const COSTS = { medium: 49, high: 89, super: 139 } as const

type ChaosBody =
  | { action_type: "double_or_nothing"; side: "blue" | "red" }
  | { action_type: "swap_teammate"; target_player_id: string }
  | { action_type: "reroll_self" }
  | { action_type: "shuffle_lanes"; target_team: "blue" | "red" }
  | { action_type: "reroll_champs"; target_team: "blue" | "red" }
  | { action_type: "target_reroll"; target_player_id: string }

function getTier(actionType: string): "medium" | "high" | "super" {
  if (actionType === "double_or_nothing") return "medium"
  if (actionType === "swap_teammate" || actionType === "reroll_self") return "high"
  return "super"
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: actions, error } = await supabase
    .from("chaos_actions")
    .select(`
      *,
      user_profiles:user_id ( discord_username, discord_avatar_url ),
      target_player:target_player_id ( name ),
      target_player_2:target_player_2_id ( name )
    `)
    .eq("session_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched = (actions ?? []).map((a: Record<string, unknown>) => {
    const profile = a.user_profiles as { discord_username: string; discord_avatar_url: string | null } | null
    const tp = a.target_player as { name: string } | null
    const tp2 = a.target_player_2 as { name: string } | null
    return {
      id: a.id,
      session_id: a.session_id,
      user_id: a.user_id,
      action_type: a.action_type,
      tier: a.tier,
      cost: a.cost,
      side: a.side,
      target_player_id: a.target_player_id,
      target_player_2_id: a.target_player_2_id,
      target_team: a.target_team,
      payout: a.payout,
      status: a.status,
      created_at: a.created_at,
      discord_username: profile?.discord_username ?? "Unknown",
      discord_avatar_url: profile?.discord_avatar_url ?? null,
      target_player_name: tp?.name ?? null,
      target_player_2_name: tp2?.name ?? null,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = (await request.json()) as ChaosBody

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select(`
      *,
      session_assignments (
        *,
        players:player_id ( id, name )
      )
    `)
    .eq("id", id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.status !== "chaos") {
    return NextResponse.json({ error: "Not in chaos phase" }, { status: 400 })
  }

  if (session.chaos_ends_at && new Date(session.chaos_ends_at) < new Date()) {
    return NextResponse.json({ error: "Chaos phase has ended" }, { status: 400 })
  }

  const tier = getTier(body.action_type)
  const cost = COSTS[tier]

  const { data: existingActions } = await supabase
    .from("chaos_actions")
    .select("*")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .neq("status", "refunded")

  const userActions = existingActions ?? []

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("player_id")
    .eq("id", user.id)
    .single()

  const userPlayerId = profile?.player_id ?? null

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

  switch (body.action_type) {
    case "double_or_nothing": {
      const donCount = userActions.filter(a => a.action_type === "double_or_nothing").length
      if (donCount >= 3) {
        return NextResponse.json({ error: "Max 3 double-or-nothing per session" }, { status: 400 })
      }

      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      const { error: insertError } = await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "double_or_nothing",
        tier: "medium",
        cost,
        side: body.side,
        status: "pending",
      })
      if (insertError) {
        await supabase.rpc("adjust_balance", { p_user_id: user.id, p_amount: cost, p_reason: "chaos_refunded" })
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    case "swap_teammate": {
      if (!userPlayerId) {
        return NextResponse.json({ error: "You must be a player to swap" }, { status: 400 })
      }

      const swapCount = userActions.filter(a => a.action_type === "swap_teammate").length
      if (swapCount >= 1) {
        return NextResponse.json({ error: "Max 1 swap per session" }, { status: 400 })
      }

      const myAssignment = assignments.find(a => a.player_id === userPlayerId)
      if (!myAssignment) {
        return NextResponse.json({ error: "You are not in this game" }, { status: 400 })
      }

      const targetAssignment = assignments.find(a => a.player_id === body.target_player_id)
      if (!targetAssignment) {
        return NextResponse.json({ error: "Target not in this game" }, { status: 400 })
      }

      if (myAssignment.side !== targetAssignment.side) {
        return NextResponse.json({ error: "Target must be on your team" }, { status: 400 })
      }

      if (myAssignment.player_id === targetAssignment.player_id) {
        return NextResponse.json({ error: "Cannot swap with yourself" }, { status: 400 })
      }

      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      await supabase
        .from("session_assignments")
        .update({
          lane: targetAssignment.lane,
          champion: targetAssignment.champion,
          champion_internal: targetAssignment.champion_internal,
          fearless_override: targetAssignment.fearless_override,
        })
        .eq("id", myAssignment.id)

      await supabase
        .from("session_assignments")
        .update({
          lane: myAssignment.lane,
          champion: myAssignment.champion,
          champion_internal: myAssignment.champion_internal,
          fearless_override: myAssignment.fearless_override,
        })
        .eq("id", targetAssignment.id)

      await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "swap_teammate",
        tier: "high",
        cost,
        target_player_id: userPlayerId,
        target_player_2_id: body.target_player_id,
        status: "resolved",
      })

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    case "reroll_self": {
      if (!userPlayerId) {
        return NextResponse.json({ error: "You must be a player to reroll" }, { status: 400 })
      }

      const selfRerollCount = userActions.filter(a => a.action_type === "reroll_self").length
      if (selfRerollCount >= 1) {
        return NextResponse.json({ error: "Max 1 self-reroll per session" }, { status: 400 })
      }

      const selfAssignment = assignments.find(a => a.player_id === userPlayerId)
      if (!selfAssignment) {
        return NextResponse.json({ error: "You are not in this game" }, { status: 400 })
      }

      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

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
        if (a.player_id !== userPlayerId) {
          lockedAssignments.set(a.player_id, {
            player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" },
            side: a.side,
            lane: a.lane,
            champion: a.champion,
            championInternal: a.champion_internal,
            locked: true,
            fearlessOverride: a.fearless_override,
          })
        }
      }

      const blueTeam = assignments.filter(a => a.side === "blue").map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const redTeam = assignments.filter(a => a.side === "red").map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const newAssignments = assignChampions(blueTeam, redTeam, fearlessBanned, lockedAssignments)
      const newSelf = newAssignments.find(a => a.player.id === userPlayerId)

      if (newSelf) {
        await supabase
          .from("session_assignments")
          .update({
            champion: newSelf.champion,
            champion_internal: newSelf.championInternal,
            fearless_override: newSelf.fearlessOverride,
          })
          .eq("id", selfAssignment.id)
      }

      await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "reroll_self",
        tier: "high",
        cost,
        target_player_id: userPlayerId,
        status: "resolved",
      })

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    case "shuffle_lanes": {
      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      const teamAssignments = assignments.filter(a => a.side === body.target_team)
      const playerIds = teamAssignments.map(a => a.player_id)

      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]]
      }

      for (let i = 0; i < teamAssignments.length; i++) {
        await supabase
          .from("session_assignments")
          .update({ player_id: playerIds[i] })
          .eq("id", teamAssignments[i].id)
      }

      await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "shuffle_lanes",
        tier: "super",
        cost,
        target_team: body.target_team,
        status: "resolved",
      })

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    case "reroll_champs": {
      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      const today = new Date().toISOString().split("T")[0]
      const { data: fearlessData } = await supabase
        .from("daily_fearless")
        .select("champion_name")
        .eq("date", today)

      const fearlessBanned = new Set<string>(
        fearlessData?.map((r: { champion_name: string }) => r.champion_name) ?? []
      )

      const teamAssignments = assignments.filter(a => a.side === body.target_team)
      const otherAssignments = assignments.filter(a => a.side !== body.target_team)

      const lockedAssignments = new Map<string, Assignment>()
      for (const a of otherAssignments) {
        lockedAssignments.set(a.player_id, {
          player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" },
          side: a.side,
          lane: a.lane,
          champion: a.champion,
          championInternal: a.champion_internal,
          locked: true,
          fearlessOverride: a.fearless_override,
        })
      }

      const blueTeam = (body.target_team === "blue" ? teamAssignments : otherAssignments).map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const redTeam = (body.target_team === "red" ? teamAssignments : otherAssignments).map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const newAssignments = assignChampions(blueTeam, redTeam, fearlessBanned, lockedAssignments)

      for (const na of newAssignments) {
        const original = teamAssignments.find(a => a.player_id === na.player.id)
        if (original) {
          await supabase
            .from("session_assignments")
            .update({
              champion: na.champion,
              champion_internal: na.championInternal,
              fearless_override: na.fearlessOverride,
            })
            .eq("id", original.id)
        }
      }

      await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "reroll_champs",
        tier: "super",
        cost,
        target_team: body.target_team,
        status: "resolved",
      })

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    case "target_reroll": {
      const targetAssignment = assignments.find(a => a.player_id === body.target_player_id)
      if (!targetAssignment) {
        return NextResponse.json({ error: "Target not in this game" }, { status: 400 })
      }

      const { error: balError } = await supabase.rpc("adjust_balance", {
        p_user_id: user.id,
        p_amount: -cost,
        p_reason: "chaos_spent",
      })
      if (balError) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      const today = new Date().toISOString().split("T")[0]
      const { data: fearlessData } = await supabase
        .from("daily_fearless")
        .select("champion_name")
        .eq("date", today)

      const fearlessBanned = new Set<string>(
        fearlessData?.map((r: { champion_name: string }) => r.champion_name) ?? []
      )

      const usedChamps = new Set(assignments.map(a => a.champion))

      const lockedAssignments = new Map<string, Assignment>()
      for (const a of assignments) {
        if (a.player_id !== body.target_player_id) {
          lockedAssignments.set(a.player_id, {
            player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" },
            side: a.side,
            lane: a.lane,
            champion: a.champion,
            championInternal: a.champion_internal,
            locked: true,
            fearlessOverride: a.fearless_override,
          })
        }
      }

      const blueTeam = assignments.filter(a => a.side === "blue").map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const redTeam = assignments.filter(a => a.side === "red").map(a => ({
        player: { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" } as Player,
        lane: a.lane as Role,
      }))

      const newAssignments = assignChampions(blueTeam, redTeam, fearlessBanned, lockedAssignments)
      const newTarget = newAssignments.find(a => a.player.id === body.target_player_id)

      if (newTarget) {
        await supabase
          .from("session_assignments")
          .update({
            champion: newTarget.champion,
            champion_internal: newTarget.championInternal,
            fearless_override: newTarget.fearlessOverride,
          })
          .eq("id", targetAssignment.id)
      }

      await supabase.from("chaos_actions").insert({
        session_id: id,
        user_id: user.id,
        action_type: "target_reroll",
        tier: "super",
        cost,
        target_player_id: body.target_player_id,
        status: "resolved",
      })

      await supabase
        .from("game_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id)

      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: "Unknown chaos action" }, { status: 400 })
  }
}
