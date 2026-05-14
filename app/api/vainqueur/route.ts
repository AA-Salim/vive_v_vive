import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { assignLanes, assignChampions } from "@/lib/randomizer"
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

  const { data: state } = await supabase
    .from("vainqueur_state")
    .select("*")
    .limit(1)
    .maybeSingle()

  const { data: queue } = await supabase
    .from("player_queue")
    .select("*, players:player_id ( id, name )")
    .order("position", { ascending: true })

  return NextResponse.json({ state, queue: queue || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 })
  }

  const { data: vState } = await supabase
    .from("vainqueur_state")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (!vState) {
    return NextResponse.json({ error: "Vainqueur state not initialized" }, { status: 500 })
  }

  switch (body.action) {
    case "activate": {
      await supabase
        .from("vainqueur_state")
        .update({
          is_active: true,
          winning_player_ids: [],
          losing_player_ids: [],
          loser_volunteers: [],
          last_session_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      return NextResponse.json({ success: true })
    }

    case "deactivate": {
      await supabase
        .from("vainqueur_state")
        .update({
          is_active: false,
          winning_player_ids: [],
          losing_player_ids: [],
          loser_volunteers: [],
          last_session_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      return NextResponse.json({ success: true })
    }

    case "volunteer": {
      if (!body.player_id) {
        return NextResponse.json({ error: "player_id required" }, { status: 400 })
      }
      const loserIds: string[] = vState.losing_player_ids || []
      if (!loserIds.includes(body.player_id)) {
        return NextResponse.json({ error: "Player is not on the losing team" }, { status: 400 })
      }
      const volunteers: string[] = vState.loser_volunteers || []
      if (volunteers.includes(body.player_id)) {
        return NextResponse.json({ error: "Already volunteered" }, { status: 400 })
      }

      await supabase
        .from("vainqueur_state")
        .update({
          loser_volunteers: [...volunteers, body.player_id],
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      return NextResponse.json({ success: true })
    }

    case "unvolunteer": {
      if (!body.player_id) {
        return NextResponse.json({ error: "player_id required" }, { status: 400 })
      }
      const volunteers: string[] = vState.loser_volunteers || []

      await supabase
        .from("vainqueur_state")
        .update({
          loser_volunteers: volunteers.filter((id: string) => id !== body.player_id),
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      return NextResponse.json({ success: true })
    }

    case "sit_out": {
      if (!body.player_id) {
        return NextResponse.json({ error: "player_id required" }, { status: 400 })
      }
      const winnerIds: string[] = vState.winning_player_ids || []
      if (!winnerIds.includes(body.player_id)) {
        return NextResponse.json({ error: "Player is not on the winning team" }, { status: 400 })
      }

      // Remove from winners, add to queue
      await supabase
        .from("vainqueur_state")
        .update({
          winning_player_ids: winnerIds.filter((id: string) => id !== body.player_id),
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      const { data: maxPos } = await supabase
        .from("player_queue")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()

      await supabase
        .from("player_queue")
        .insert({ player_id: body.player_id, position: (maxPos?.position ?? 0) + 1 })

      return NextResponse.json({ success: true })
    }

    case "next_game": {
      if (!vState.is_active) {
        return NextResponse.json({ error: "Vainqueur is not active" }, { status: 400 })
      }

      const winnerIds: string[] = vState.winning_player_ids || []
      const loserIds: string[] = vState.losing_player_ids || []
      const volunteers: string[] = vState.loser_volunteers || []

      const { data: queue } = await supabase
        .from("player_queue")
        .select("id, player_id, position")
        .order("position", { ascending: true })

      const queuePlayers = queue || []
      const queueCount = queuePlayers.length

      let newTeamPlayerIds: string[]
      let playersToQueue: string[] = []

      if (queueCount >= 5) {
        // Full replacement: 5 from queue replace all losers
        newTeamPlayerIds = queuePlayers.slice(0, 5).map((q) => q.player_id)
        playersToQueue = [...loserIds]

        // Remove used from queue
        const usedQueueIds = queuePlayers.slice(0, 5).map((q) => q.id)
        await supabase.from("player_queue").delete().in("id", usedQueueIds)
      } else if (queueCount > 0) {
        // Partial: some from queue, some losers stay
        const fromQueue = queuePlayers.map((q) => q.player_id)
        const needFromLosers = 5 - queueCount

        let stayingLosers: string[]
        const nonVolunteers = loserIds.filter((id) => !volunteers.includes(id))

        if (volunteers.length === needFromLosers) {
          stayingLosers = volunteers
        } else if (volunteers.length > needFromLosers) {
          // Random pick from volunteers
          const shuffled = [...volunteers].sort(() => Math.random() - 0.5)
          stayingLosers = shuffled.slice(0, needFromLosers)
        } else {
          // All volunteers stay + random from non-volunteers
          stayingLosers = [...volunteers]
          const remaining = needFromLosers - volunteers.length
          const shuffledNon = [...nonVolunteers].sort(() => Math.random() - 0.5)
          stayingLosers.push(...shuffledNon.slice(0, remaining))
        }

        playersToQueue = loserIds.filter((id) => !stayingLosers.includes(id))
        newTeamPlayerIds = [...fromQueue, ...stayingLosers]

        // Remove all from queue
        await supabase.from("player_queue").delete().in("id", queuePlayers.map((q) => q.id))
      } else {
        // No queue: all 10 stay (rematch)
        newTeamPlayerIds = loserIds
      }

      // Add departing losers to back of queue
      if (playersToQueue.length > 0) {
        const { data: maxPos } = await supabase
          .from("player_queue")
          .select("position")
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle()

        let pos = (maxPos?.position ?? 0) + 1
        const queueRows = playersToQueue.map((player_id) => ({
          player_id,
          position: pos++,
        }))
        await supabase.from("player_queue").insert(queueRows)
      }

      // Create new session with 10 players (winners + new team)
      const allPlayerIds = [...winnerIds, ...newTeamPlayerIds]

      if (allPlayerIds.length !== 10) {
        return NextResponse.json(
          { error: `Expected 10 players, got ${allPlayerIds.length}` },
          { status: 500 }
        )
      }

      const { data: players } = await supabase
        .from("players")
        .select("id, name, is_active, wins, losses, games_played, created_at")
        .in("id", allPlayerIds)

      if (!players || players.length !== 10) {
        return NextResponse.json(
          { error: "Could not fetch all players" },
          { status: 500 }
        )
      }

      // Re-randomize sides
      const shuffled = [...players].sort(() => Math.random() - 0.5)
      const blueTeam = shuffled.slice(0, 5) as Player[]
      const redTeam = shuffled.slice(5, 10) as Player[]

      const blueWithLanes = assignLanes(blueTeam)
      const redWithLanes = assignLanes(redTeam)

      const today = new Date().toISOString().split("T")[0]
      const { data: fearlessData } = await supabase
        .from("daily_fearless")
        .select("champion_name")
        .eq("date", today)

      const fearlessBanned = new Set(
        fearlessData?.map((r: { champion_name: string }) => r.champion_name) ?? []
      )

      const championPools = await getChampionPools()

      const assignments = assignChampions(
        blueWithLanes,
        redWithLanes,
        fearlessBanned,
        new Map(),
        championPools
      )

      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .insert({
          status: "draft",
          game_mode: "vainqueur",
          created_by: user.id,
        })
        .select()
        .single()

      if (sessionError) {
        if (sessionError.code === "23505") {
          return NextResponse.json(
            { error: "An active session already exists" },
            { status: 409 }
          )
        }
        return NextResponse.json({ error: sessionError.message }, { status: 500 })
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
        return NextResponse.json({ error: assignError.message }, { status: 500 })
      }

      // Reset vainqueur state for the new game
      await supabase
        .from("vainqueur_state")
        .update({
          winning_player_ids: [],
          losing_player_ids: [],
          loser_volunteers: [],
          last_session_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vState.id)

      const { data: full } = await supabase
        .from("game_sessions")
        .select(SESSION_SELECT)
        .eq("id", session.id)
        .single()

      return NextResponse.json(full, { status: 201 })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }
}
