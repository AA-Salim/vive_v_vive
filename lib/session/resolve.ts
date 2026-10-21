import type { SupabaseClient } from "@supabase/supabase-js"
import { runGameCanceledHooks, runGameResolvedHooks } from "@/lib/game-hooks"
import type { HookAssignment } from "@/lib/game-hooks/types"
import type { Side } from "@/lib/types"
import {
  ACTIVE_SESSION_STATUSES,
  GAME_PARTICIPATION_POINTS,
  GAME_WIN_POINTS,
  STALE_CLAIM_MS,
  isActiveStatus,
  winnerOf,
} from "@/lib/session/constants"
import { SESSION_SELECT, fail, loadSession, type ActionOutcome, type SessionRow, type Viewer } from "@/lib/session/server"

const SIDE_LABEL: Record<Side, string> = { blue: "Blue side", red: "Red side" }

function hookAssignments(session: SessionRow): HookAssignment[] {
  return session.session_assignments.map((a) => ({
    player_id: a.player_id,
    side: a.side,
    lane: a.lane,
    champion: a.champion,
    players: { id: a.players.id, name: a.players.name },
  }))
}

// A claim left behind by a request that died can be taken over once it is STALE_CLAIM_MS old. The takeover
// matches the exact stale claim (holder + timestamp), so two rescuers can never both win it.
async function staleClaim(supabase: SupabaseClient, sessionId: string, statuses: string[]) {
  const { data } = await supabase
    .from("game_sessions")
    .select("status, resolved_by, updated_at, game_id")
    .eq("id", sessionId)
    .maybeSingle()
  if (!data?.resolved_by || !statuses.includes(data.status)) return null
  if (Date.now() - Date.parse(data.updated_at) < STALE_CLAIM_MS) return null
  return data as { status: string; resolved_by: string; updated_at: string; game_id: string | null }
}

async function claimResolution(supabase: SupabaseClient, sessionId: string, userId: string) {
  const claim = () =>
    supabase
      .from("game_sessions")
      .update({ resolved_by: userId, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "in_game")

  const { data: fresh } = await claim().is("resolved_by", null).select(SESSION_SELECT).maybeSingle()
  if (fresh) return fresh as SessionRow

  const stale = await staleClaim(supabase, sessionId, ["in_game"])
  if (!stale) return null
  const { data: rescued } = await claim()
    .eq("resolved_by", stale.resolved_by)
    .eq("updated_at", stale.updated_at)
    .select(SESSION_SELECT)
    .maybeSingle()
  return (rescued as SessionRow | null) ?? null
}

async function releaseClaim(supabase: SupabaseClient, sessionId: string, userId: string) {
  await supabase
    .from("game_sessions")
    .update({ resolved_by: null })
    .eq("id", sessionId)
    .eq("status", "in_game")
    .eq("resolved_by", userId)
}

async function adjustBalance(supabase: SupabaseClient, userId: string, amount: number, reason: string, referenceId: string) {
  const args = { p_user_id: userId, p_amount: amount, p_reason: reason, p_reference_id: referenceId }
  const { error } = await supabase.rpc("adjust_balance", args)
  if (error) await supabase.rpc("adjust_balance", args)
}

async function recordGame(
  supabase: SupabaseClient,
  session: SessionRow,
  userId: string,
  winnerSide: Side
): Promise<{ gameId: string } | { error: string }> {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({ winner_side: winnerSide })
    .select("id")
    .single()
  if (gameError || !game) return { error: gameError?.message ?? "Could not record the game" }

  const { data: linked } = await supabase
    .from("game_sessions")
    .update({ game_id: game.id })
    .eq("id", session.id)
    .eq("resolved_by", userId)
    .is("game_id", null)
    .select("id")
    .maybeSingle()
  if (!linked) {
    await supabase.from("games").delete().eq("id", game.id)
    return { error: "Another declaration took over this game" }
  }

  const assignments = session.session_assignments
  const { error: playersError } = await supabase.from("game_players").insert(
    assignments.map((a) => ({ game_id: game.id, player_id: a.player_id, side: a.side, lane: a.lane, champion: a.champion }))
  )
  if (playersError) {
    await supabase.from("game_sessions").update({ game_id: null }).eq("id", session.id).eq("game_id", game.id)
    await supabase.from("games").delete().eq("id", game.id)
    return { error: playersError.message }
  }

  const today = new Date().toISOString().split("T")[0]
  const champions = [...new Set(assignments.map((a) => a.champion))]
  await supabase
    .from("daily_fearless")
    .upsert(champions.map((champion_name) => ({ champion_name, date: today })), { onConflict: "date,champion_name" })

  const { data: players } = await supabase
    .from("players")
    .select("id, wins, losses, games_played, auth_user_id")
    .in("id", assignments.map((a) => a.player_id))

  const sideOf = new Map(assignments.map((a) => [a.player_id, a.side]))
  await Promise.all(
    (players ?? []).map(async (p) => {
      const won = sideOf.get(p.id) === winnerSide
      await supabase
        .from("players")
        .update(
          won
            ? { wins: p.wins + 1, games_played: p.games_played + 1 }
            : { losses: p.losses + 1, games_played: p.games_played + 1 }
        )
        .eq("id", p.id)
      if (p.auth_user_id) {
        await adjustBalance(
          supabase,
          p.auth_user_id,
          won ? GAME_WIN_POINTS : GAME_PARTICIPATION_POINTS,
          won ? "game_win" : "game_participation",
          session.id
        )
      }
    })
  )

  return { gameId: game.id as string }
}

async function updateVainqueur(supabase: SupabaseClient, sessionId: string, winnerIds: string[], loserIds: string[]) {
  const { data: state } = await supabase.from("vainqueur_state").select("id, is_active").limit(1).maybeSingle()
  if (!state?.is_active) return
  await supabase
    .from("vainqueur_state")
    .update({
      winning_player_ids: winnerIds,
      losing_player_ids: loserIds,
      loser_volunteers: [],
      last_session_id: sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id)
}

// Claim (resolved_by) -> record the game and link it before any points move -> settle every feature hook ->
// flip the status last, so whoever sees the result also sees settled payouts. A claim whose request died can be
// retried after STALE_CLAIM_MS; the linked game_id makes the retry skip recording and paying the game again.
export async function declareWinner(
  supabase: SupabaseClient,
  session: SessionRow,
  viewer: Viewer,
  winnerSide: Side
): Promise<ActionOutcome> {
  const userId = viewer.user?.id
  if (!userId) return fail(401, "Sign in to declare the winner", "auth_required")

  const declared = winnerOf(session.status)
  if (declared) return fail(409, `Already settled: ${SIDE_LABEL[declared]} won.`, "already_resolved")
  if (session.status !== "in_game") {
    return fail(409, isActiveStatus(session.status) ? "The game has not started yet." : "This game is already over.", "wrong_phase")
  }

  const claimed = await claimResolution(supabase, session.id, userId)
  if (!claimed) {
    const { session: latest } = await loadSession(supabase, session.id)
    const latestWinner = latest ? winnerOf(latest.status) : null
    if (latestWinner) return fail(409, `Already settled: ${SIDE_LABEL[latestWinner]} won.`, "already_resolved")
    return fail(409, "Someone is already declaring the winner.", "resolving")
  }

  let gameId = claimed.game_id
  if (gameId) {
    const { data: game } = await supabase.from("games").select("winner_side").eq("id", gameId).maybeSingle()
    const recorded = (game?.winner_side ?? null) as Side | null
    if (recorded && recorded !== winnerSide) {
      await releaseClaim(supabase, session.id, userId)
      return fail(
        409,
        `This game is already recorded as a ${SIDE_LABEL[recorded]} win. Declare ${SIDE_LABEL[recorded]} to finish settling it.`,
        "recorded_side"
      )
    }
  } else {
    const recorded = await recordGame(supabase, claimed, userId, winnerSide)
    if ("error" in recorded) {
      await releaseClaim(supabase, session.id, userId)
      return fail(500, recorded.error)
    }
    gameId = recorded.gameId
  }

  const assignments = hookAssignments(claimed)
  const winnerIds = assignments.filter((a) => a.side === winnerSide).map((a) => a.player_id)
  const loserIds = assignments.filter((a) => a.side !== winnerSide).map((a) => a.player_id)

  await runGameResolvedHooks({ supabase, sessionId: session.id, gameId, winnerSide, assignments, winnerIds, loserIds })

  const { data: finished, error } = await supabase
    .from("game_sessions")
    .update({ status: winnerSide === "blue" ? "blue_win" : "red_win", game_id: gameId, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "in_game")
    .eq("resolved_by", userId)
    .select(SESSION_SELECT)
    .maybeSingle()
  if (error || !finished) {
    return fail(500, error?.message ?? "The game was settled but its result could not be saved. Retry in two minutes.")
  }

  await updateVainqueur(supabase, session.id, winnerIds, loserIds)
  return { ok: true, session: finished as SessionRow, changed: true }
}

export async function cancelSession(supabase: SupabaseClient, session: SessionRow, viewer: Viewer): Promise<ActionOutcome> {
  const userId = viewer.user?.id
  if (!userId) return fail(401, "Sign in to cancel the game", "auth_required")
  if (session.status === "canceled") return { ok: true, session, changed: false }
  if (!isActiveStatus(session.status)) return fail(409, "This game is already over.", "already_resolved")

  const cancel = () =>
    supabase
      .from("game_sessions")
      .update({ status: "canceled", resolved_by: userId, updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .in("status", ACTIVE_SESSION_STATUSES)
      .is("game_id", null)

  const first = await cancel().is("resolved_by", null).select(SESSION_SELECT).maybeSingle()
  let canceled = (first.data as SessionRow | null) ?? null
  if (!canceled && viewer.isAdmin) {
    const stale = await staleClaim(supabase, session.id, ACTIVE_SESSION_STATUSES)
    if (stale && !stale.game_id) {
      const rescued = await cancel()
        .eq("resolved_by", stale.resolved_by)
        .eq("updated_at", stale.updated_at)
        .select(SESSION_SELECT)
        .maybeSingle()
      canceled = (rescued.data as SessionRow | null) ?? null
    }
  }

  if (!canceled) {
    const { session: latest } = await loadSession(supabase, session.id)
    if (latest?.status === "canceled") return { ok: true, session: latest, changed: false }
    if (latest && winnerOf(latest.status)) return fail(409, "This game is already over.", "already_resolved")
    if (latest?.game_id) {
      return fail(409, "This game is already recorded. Declare the winner to finish settling it.", "recorded_side")
    }
    return fail(409, "A winner is being declared right now.", "resolving")
  }

  await runGameCanceledHooks({ supabase, sessionId: session.id })
  return { ok: true, session: canceled, changed: true }
}
