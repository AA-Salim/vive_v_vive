import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { splitTeams, assignLanes, assignChampions } from "@/lib/randomizer"
import { getChampionPools } from "@/lib/champions-db"
import type { Player } from "@/lib/types"
import { isActiveStatus } from "@/lib/session/constants"
import { todaysFearless } from "@/lib/session/phases"
import {
  advanceExpiredPhase,
  errorResponse,
  isRecentResult,
  loadLatestSession,
  loadSession,
  presentSession,
  sessionResponse,
} from "@/lib/session/server"
import { createSessionSchema } from "@/lib/session/types"

// Returns the active game, or the game that ended in the last 30 minutes (recent_result: true) so every client
// can show the result screen, or null. Expired chaos/betting timers are advanced here, at most once.
export async function GET() {
  const supabase = await createClient()
  const { session, error } = await loadLatestSession(supabase)
  if (error) return errorResponse(500, error.message ?? "Could not load the game")
  if (!session) return sessionResponse(null)

  const current = isActiveStatus(session.status) ? await advanceExpiredPhase(supabase, session) : session
  if (!isActiveStatus(current.status) && !isRecentResult(current)) return sessionResponse(null)
  return sessionResponse(await presentSession(supabase, current))
}

export async function POST(request: Request) {
  const parsed = createSessionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Pick exactly 10 players")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return errorResponse(401, "Sign in with Discord to start a game.", "auth_required")

  const playerIds = parsed.data.player_ids
  const [{ data: players, error: playersError }, fearless, pools] = await Promise.all([
    supabase.from("players").select("id, name, is_active, wins, losses, games_played, created_at").in("id", playerIds),
    todaysFearless(supabase),
    getChampionPools(),
  ])
  if (playersError) return errorResponse(500, playersError.message)
  if (!players || players.length !== 10) return errorResponse(400, "Some of those players no longer exist. Refresh the roster.")

  const { blue, red } = splitTeams(players as Player[])
  const assignments = assignChampions(assignLanes(blue), assignLanes(red), fearless, new Map(), pools)

  const { data: created, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({ status: "draft", created_by: user.id })
    .select("id")
    .single()
  if (sessionError) {
    if (sessionError.code === "23505") return errorResponse(409, "A game is already running.", "active_session")
    return errorResponse(500, sessionError.message)
  }

  const { error: assignError } = await supabase.from("session_assignments").insert(
    assignments.map((a) => ({
      session_id: created.id,
      player_id: a.player.id,
      side: a.side,
      lane: a.lane,
      champion: a.champion,
      champion_internal: a.championInternal,
      locked: false,
      fearless_override: a.fearlessOverride,
    }))
  )
  if (assignError) {
    await supabase.from("game_sessions").delete().eq("id", created.id)
    return errorResponse(500, assignError.message)
  }

  const { session } = await loadSession(supabase, created.id)
  if (!session) return errorResponse(500, "The game was created but could not be loaded.")

  emitLive("session.created", { sessionId: session.id, actor: await getActor(supabase, user.id), data: { mode: "standard" } })
  return sessionResponse(await presentSession(supabase, session), { status: 201 })
}
