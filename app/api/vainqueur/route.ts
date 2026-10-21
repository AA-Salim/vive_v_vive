import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { RESULT_WINDOW_MS, winnerOf } from "@/lib/session/constants"
import { presentSession } from "@/lib/session/server"
import { ADMIN_ONLY, AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"
import { appendToQueue, loadQueue, removeFromQueue } from "@/lib/lobby/server/queue"
import { rotateToNextGame } from "@/lib/lobby/server/rotate"
import {
  buildView,
  loadLastGame,
  loadStateRows,
  mutateState,
  playerRefs,
  satOutOf,
  type Mutation,
  type StateRow,
} from "@/lib/lobby/server/vainqueur-state"
import { getLobbyViewer, resolveTarget } from "@/lib/lobby/server/viewer"
import { VainqueurActionSchema } from "@/lib/lobby/types"
import type { SessionStatus, Side } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function GET() {
  const supabase = await createClient()
  const { rows, error } = await loadStateRows(supabase)
  if (error) return fail(500, "The rotation ledger is unreadable right now.")
  return ok(await buildView(supabase, rows[0] ?? null))
}

const RESET = { winning_player_ids: [], losing_player_ids: [], loser_volunteers: [], last_session_id: null }

interface SeedRow {
  id: string
  status: SessionStatus
  updated_at: string
  session_assignments: { player_id: string; side: Side }[] | null
}

// Turning the rotation on right after a game picks that result up, so nobody has to replay it. Canceled games
// are skipped (a misdeal right after a result still counts that result); a game in progress decides instead.
async function seedFromLatestGame(supabase: SupabaseClient) {
  const { data: recent } = await supabase
    .from("game_sessions")
    .select("id, status, updated_at, session_assignments ( player_id, side )")
    .order("created_at", { ascending: false })
    .limit(5)
  const data = ((recent ?? []) as SeedRow[]).find((s) => s.status !== "canceled" && s.status !== "expired")
  const winner = data ? winnerOf(data.status) : null
  if (!data || !winner || Date.now() - Date.parse(data.updated_at) > RESULT_WINDOW_MS) return RESET
  const seats = data.session_assignments ?? []
  return {
    winning_player_ids: seats.filter((s) => s.side === winner).map((s) => s.player_id),
    losing_player_ids: seats.filter((s) => s.side !== winner).map((s) => s.player_id),
    loser_volunteers: [],
    last_session_id: data.id as string,
  }
}

function requireResult(state: StateRow): Mutation | null {
  if (!state.is_active) return { status: 409, error: "Winner stays is not running.", code: "inactive" }
  if (!state.last_session_id) return { status: 409, error: "Wait for the current game to end.", code: "no_result" }
  return null
}

export async function POST(request: Request) {
  const parsed = VainqueurActionSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error, "Unknown rotation action")
  const action = parsed.data

  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()
  const actor = await getActor(supabase, viewer.userId)

  if (action.action === "next_game") {
    const outcome = await rotateToNextGame(supabase, viewer, action.mode ?? "throne")
    if (!outcome.ok) return fail(outcome.status, outcome.error, outcome.code)
    const sessionId = outcome.session.id
    emitLive("session.created", { sessionId, actor, data: { mode: "vainqueur" } })
    emitLive("vainqueur.changed", {
      sessionId,
      actor,
      data: {
        action: "rotated",
        mode: action.mode ?? "throne",
        stayed: outcome.names.stayed,
        comingIn: outcome.names.comingIn,
        rotatedOut: outcome.names.rotatedOut,
        targetUserIds: outcome.comingInUserIds,
      },
    })
    emitLive("queue.changed", { actor, data: { action: "advanced", count: outcome.names.rotatedOut.length }, persist: false })
    return ok(await presentSession(supabase, outcome.session), 201)
  }

  if (action.action === "activate" || action.action === "deactivate") {
    if (!viewer.isAdmin) return ADMIN_ONLY()
    const activate = action.action === "activate"
    const seed = activate ? await seedFromLatestGame(supabase) : RESET
    const outcome = await mutateState(supabase, (state) =>
      state.is_active === activate ? { done: true } : { patch: { is_active: activate, ...seed } }
    )
    if (!outcome.ok) return fail(outcome.status, outcome.error, outcome.code)
    if (outcome.changed) {
      emitLive("vainqueur.changed", { actor, data: { action: activate ? "activated" : "deactivated" } })
    }
    return ok(await buildView(supabase, outcome.row))
  }

  const target = resolveTarget(viewer, action.player_id)
  if ("error" in target) return fail(target.status, target.error, "no_player")
  const playerId = target.playerId
  const refs = await playerRefs(supabase, [playerId])
  const player = refs.get(playerId)
  if (!player) return fail(404, "That player does not exist.")

  const outcome = await mutateState(supabase, async (state) => {
    const blocked = requireResult(state)
    if (blocked) return blocked
    const winners = state.winning_player_ids ?? []
    const losers = state.losing_player_ids ?? []
    const volunteers = state.loser_volunteers ?? []
    switch (action.action) {
      case "volunteer":
        if (!losers.includes(playerId)) return { status: 409, error: "Only last game's losers can volunteer to stay.", code: "not_loser" }
        return volunteers.includes(playerId) ? { done: true } : { patch: { loser_volunteers: [...volunteers, playerId] } }
      case "unvolunteer":
        return volunteers.includes(playerId) ? { patch: { loser_volunteers: volunteers.filter((id) => id !== playerId) } } : { done: true }
      case "sit_out": {
        if (winners.includes(playerId)) return { patch: { winning_player_ids: winners.filter((id) => id !== playerId) } }
        const last = await loadLastGame(supabase, state.last_session_id)
        if (satOutOf(state, last).includes(playerId)) return { done: true }
        return { status: 409, error: "Only last game's winners hold a seat to give up.", code: "not_winner" }
      }
      case "return": {
        if (winners.includes(playerId)) return { done: true }
        const last = await loadLastGame(supabase, state.last_session_id)
        if (!satOutOf(state, last).includes(playerId)) {
          return { status: 409, error: "Only winners who gave up their seat can take it back.", code: "not_winner" }
        }
        return { patch: { winning_player_ids: [...winners, playerId] } }
      }
    }
  })
  if (!outcome.ok) return fail(outcome.status, outcome.error, outcome.code)

  if (outcome.changed) {
    if (action.action === "sit_out") {
      const { snapshot } = await loadQueue(supabase)
      await appendToQueue(supabase, snapshot, [playerId])
    } else if (action.action === "return") {
      await removeFromQueue(supabase, [playerId])
    }
    const verb = { volunteer: "volunteered", unvolunteer: "unvolunteered", sit_out: "sat_out", return: "returned" }[action.action]
    emitLive("vainqueur.changed", {
      actor,
      data: { action: verb, playerName: player.name, targetUserId: player.userId !== viewer.userId ? player.userId : null },
    })
    if (action.action === "sit_out" || action.action === "return") {
      emitLive("queue.changed", { actor, data: { action: action.action === "sit_out" ? "joined" : "left", playerName: player.name }, persist: false })
    }
  }
  return ok(await buildView(supabase, outcome.row))
}
