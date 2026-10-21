import type { SupabaseClient } from "@supabase/supabase-js"
import { getChampionPools } from "@/lib/champions-db"
import { assignChampions, assignLanes } from "@/lib/randomizer"
import { todaysFearless } from "@/lib/session/phases"
import { ACTIVE_SESSION_STATUSES } from "@/lib/session/constants"
import { loadSession, type SessionRow } from "@/lib/session/server"
import { drawRotation, formTeams, planRotation } from "@/lib/lobby/rotation"
import { appendToQueue, loadQueue, removeFromQueue } from "@/lib/lobby/server/queue"
import { loadLastGame, loadStateRows, playerRefs, satOutOf, writeState, type StateRow } from "@/lib/lobby/server/vainqueur-state"
import type { LobbyViewer } from "@/lib/lobby/server/viewer"
import type { RotationMode } from "@/lib/lobby/types"
import type { Player } from "@/lib/types"

export type RotateOutcome =
  | {
      ok: true
      session: SessionRow
      names: { stayed: string[]; comingIn: string[]; rotatedOut: string[] }
      rotatedOutUserIds: string[]
      comingInUserIds: string[]
    }
  | { ok: false; status: number; error: string; code?: string }

const fail = (status: number, error: string, code?: string): RotateOutcome => ({ ok: false, status, error, code })

function restorePatch(state: StateRow) {
  return {
    winning_player_ids: state.winning_player_ids,
    losing_player_ids: state.losing_player_ids,
    loser_volunteers: state.loser_volunteers,
    last_session_id: state.last_session_id,
  }
}

const RETRY = "retry" as const

// Claims the rotation with a compare-and-set before anything else moves: a double click or two hosts racing
// advance it at most once, and a failed game creation puts the winners and losers back. A volunteer or a
// seat given up in the same instant only changes the plan, so the rotation is planned again.
export async function rotateToNextGame(supabase: SupabaseClient, viewer: LobbyViewer, mode: RotationMode): Promise<RotateOutcome> {
  if (!viewer.userId) return fail(401, "Sign in with Discord first.", "auth_required")
  for (let attempt = 0; attempt < 3; attempt++) {
    const outcome = await attemptRotation(supabase, viewer, mode)
    if (outcome !== RETRY) return outcome
  }
  return fail(409, "The rotation kept changing while it turned. Try again.", "stale")
}

async function attemptRotation(supabase: SupabaseClient, viewer: LobbyViewer, mode: RotationMode): Promise<RotateOutcome | typeof RETRY> {
  const { rows, error } = await loadStateRows(supabase)
  if (error) return fail(500, error.message ?? "Could not read the rotation")
  const state = rows[0]
  if (!state?.is_active) return fail(409, "Winner stays is not running.", "inactive")

  const last = await loadLastGame(supabase, state.last_session_id)
  if (!last?.winner) return fail(409, "Finish a game first: the rotation needs winners and losers.", "no_result")
  if (!viewer.isAdmin && viewer.userId !== last.createdBy) {
    return fail(403, "Only the host of the last game or an admin can rotate.", "forbidden")
  }

  const { data: running } = await supabase.from("game_sessions").select("id").in("status", ACTIVE_SESSION_STATUSES).limit(1)
  if ((running ?? []).length > 0) return fail(409, "A game is already running.", "active_session")

  const { snapshot, error: queueError } = await loadQueue(supabase)
  if (queueError) return fail(500, queueError.message ?? "Could not read the queue")

  const satOut = satOutOf(state, last)
  const refs = await playerRefs(supabase, [...last.winners, ...last.losers, ...snapshot.entries.map((e) => e.player_id)])
  const available = (ids: string[]) => ids.filter((id) => refs.get(id)?.active)

  const plan = planRotation({
    winners: available(state.winning_player_ids ?? []),
    satOut: available(satOut),
    losers: available(state.losing_player_ids ?? []),
    volunteers: state.loser_volunteers ?? [],
    queue: snapshot.entries.map((e) => e.player_id),
  })
  if (plan.short > 0) {
    return fail(409, `Not enough players: ${plan.short} more need to join the queue.`, "short")
  }
  const draw = drawRotation(plan)

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, is_active, wins, losses, games_played, created_at")
    .in("id", draw.lineup)
  if (playersError) return fail(500, playersError.message)
  if (!players || players.length !== draw.lineup.length) return fail(409, "Some players left the roster. Refresh and try again.", "stale")

  const claimed = await writeState(supabase, rows, {
    winning_player_ids: [],
    losing_player_ids: [],
    loser_volunteers: [],
    last_session_id: null,
  })
  if (claimed.error) return fail(500, claimed.error.message ?? "Could not claim the rotation")
  if (!claimed.row) {
    const { rows: latest } = await loadStateRows(supabase)
    const moved = !latest[0]?.is_active || latest[0].last_session_id !== state.last_session_id
    return moved ? fail(409, "The rotation already moved. Look up.", "stale") : RETRY
  }
  const claimedRows = [claimed.row, ...rows.slice(1)]
  const restore = () => writeState(supabase, claimedRows, restorePatch(state))

  const byId = new Map((players as Player[]).map((p) => [p.id, p]))
  const teams = formTeams(draw.lineup, [...plan.staying, ...plan.forced], mode)
  const roster = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is Player => !!p)
  const [fearless, pools] = await Promise.all([todaysFearless(supabase), getChampionPools()])
  const assignments = assignChampions(assignLanes(roster(teams.blue)), assignLanes(roster(teams.red)), fearless, new Map(), pools)

  const { data: created, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({ status: "draft", game_mode: "vainqueur", created_by: viewer.userId })
    .select("id")
    .single()
  if (sessionError || !created) {
    await restore()
    if (sessionError?.code === "23505") return fail(409, "A game is already running.", "active_session")
    return fail(500, sessionError?.message ?? "Could not create the next game")
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
    await restore()
    return fail(500, assignError.message)
  }

  await removeFromQueue(supabase, [...draw.lineup, ...draw.rotatingOut])
  const { snapshot: after } = await loadQueue(supabase)
  await appendToQueue(supabase, after, draw.rotatingOut)

  const { session } = await loadSession(supabase, created.id)
  if (!session) return fail(500, "The next game was created but could not be loaded.")

  const nameOf = (id: string) => refs.get(id)?.name ?? byId.get(id)?.name ?? "Someone"
  const userOf = (id: string) => refs.get(id)?.userId ?? null
  const incoming = [...plan.comingIn, ...plan.forced]
  return {
    ok: true,
    session,
    names: {
      stayed: [...plan.staying, ...draw.stayingLosers].map(nameOf),
      comingIn: incoming.map(nameOf),
      rotatedOut: draw.rotatingOut.map(nameOf),
    },
    rotatedOutUserIds: draw.rotatingOut.map(userOf).filter((id): id is string => !!id),
    comingInUserIds: incoming.map(userOf).filter((id): id is string => !!id),
  }
}
