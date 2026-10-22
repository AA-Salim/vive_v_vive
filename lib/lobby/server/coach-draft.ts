import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { LANES, sideForPick } from "@/lib/lobby/constants"
import { COACH_DRAFT_ERRORS, coachDraftCode, type CoachDraftErrorCode } from "@/lib/lobby/server/coach-errors"
import type { LobbyViewer } from "@/lib/lobby/server/viewer"
import type { Role, SessionStatus, Side } from "@/lib/types"

export interface DraftSession {
  id: string
  status: SessionStatus
  created_by: string | null
  blue_coach_id: string | null
  red_coach_id: string | null
  draft_turn: Side | null
  updated_at: string
  coach_pool?: string[] | null
  champion_draft_at?: string | null
}

export interface DraftPick {
  id: string
  session_id: string
  pick_number: number
  player_id: string
  side: Side
  lane: Role | null
  created_at: string
}

export interface Draft {
  session: DraftSession
  picks: DraftPick[]
}

export type DraftOutcome<T> = { ok: true; value: T } | { ok: false; code: CoachDraftErrorCode | "server"; message?: string }

export interface PickResult {
  pickNumber: number
  side: Side
  nextSide: Side | null
  playerId: string
  playerName: string
  playerUserId: string | null
}

export interface UndoResult {
  pickNumber: number
  side: Side
  playerId: string
  playerName: string
}

const rejected = <T>(code: CoachDraftErrorCode | "server", message?: string): DraftOutcome<T> => ({ ok: false, code, message })

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function coachOf(session: DraftSession, side: Side): string | null {
  return side === "blue" ? session.blue_coach_id : session.red_coach_id
}

export function sideOfCoach(session: DraftSession, userId: string | null): Side | null {
  if (!userId) return null
  if (session.blue_coach_id === userId) return "blue"
  if (session.red_coach_id === userId) return "red"
  return null
}

// Session first, then picks: every pick, undo and lane change writes its picks before bumping updated_at, so the
// picks read here are at least as new as the version a confirm compares against.
export async function loadDraft(supabase: SupabaseClient, sessionId: string): Promise<{ draft: Draft | null; error: string | null }> {
  const { data: session, error } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle()
  if (error) return { draft: null, error: error.message ?? "Could not load the draft" }
  if (!session) return { draft: null, error: null }
  const { data: picks, error: picksError } = await supabase
    .from("coach_draft_picks")
    .select("*")
    .eq("session_id", sessionId)
    .order("pick_number", { ascending: true })
  if (picksError) return { draft: null, error: picksError.message ?? "Could not load the draft" }
  return { draft: { session: session as DraftSession, picks: (picks ?? []) as DraftPick[] }, error: null }
}

function fromDb<T>(error: { message?: string } | null): DraftOutcome<T> {
  const code = coachDraftCode(error?.message)
  return code ? rejected(code) : rejected("server", error?.message)
}

async function legacyPick(supabase: SupabaseClient, viewer: LobbyViewer, draft: Draft, playerId: string): Promise<DraftOutcome<PickResult>> {
  const { session, picks } = draft
  if (session.status !== "coach_draft") return rejected("not_drafting")
  if (picks.length >= 10) return rejected("draft_full")
  const pickNumber = picks.length + 1
  const side = sideForPick(pickNumber)
  if (!side || coachOf(session, side) !== viewer.userId) return rejected("not_your_turn")
  if (picks.some((p) => p.player_id === playerId)) return rejected("already_picked")
  const pool = session.coach_pool ?? null
  if (pool && pool.length > 0 && !pool.includes(playerId)) return rejected("not_in_pool")

  const { data: player } = await supabase.from("players").select("id, name, is_active, auth_user_id").eq("id", playerId).maybeSingle()
  if (!player?.is_active) return rejected("player_unavailable")

  const { error } = await supabase
    .from("coach_draft_picks")
    .insert({ session_id: session.id, pick_number: pickNumber, player_id: playerId, side })
  if (error) return error.code === "23505" ? rejected("stale") : rejected("server", error.message)

  const nextSide = sideForPick(pickNumber + 1)
  await supabase
    .from("game_sessions")
    .update({ draft_turn: nextSide, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "coach_draft")
  return {
    ok: true,
    value: { pickNumber, side, nextSide, playerId, playerName: player.name as string, playerUserId: (player.auth_user_id as string | null) ?? null },
  }
}

export async function pickPlayer(supabase: SupabaseClient, viewer: LobbyViewer, draft: Draft, playerId: string): Promise<DraftOutcome<PickResult>> {
  const { data, error } = await supabase.rpc("coach_draft_pick", { p_session_id: draft.session.id, p_player_id: playerId })
  if (error) return isMissingSchema(error) ? legacyPick(supabase, viewer, draft, playerId) : fromDb(error)
  const row = data as { pick_number: number; side: Side; next_side: Side | null; player_id: string; player_name: string; player_user_id: string | null }
  return {
    ok: true,
    value: {
      pickNumber: row.pick_number,
      side: row.side,
      nextSide: row.next_side,
      playerId: row.player_id,
      playerName: row.player_name,
      playerUserId: row.player_user_id,
    },
  }
}

export async function undoPick(supabase: SupabaseClient, draft: Draft): Promise<DraftOutcome<UndoResult>> {
  const { data, error } = await supabase.rpc("coach_draft_undo", { p_session_id: draft.session.id })
  if (error) return isMissingSchema(error) ? rejected("undo_unavailable") : fromDb(error)
  const row = data as { pick_number: number; side: Side; player_id: string; player_name: string | null }
  return { ok: true, value: { pickNumber: row.pick_number, side: row.side, playerId: row.player_id, playerName: row.player_name ?? "a player" } }
}

export interface LaneChange {
  pickId: string
  playerId: string
  lane: Role | null
}

function canSetLanes(viewer: LobbyViewer, session: DraftSession, side: Side) {
  return viewer.isAdmin || coachOf(session, side) === viewer.userId
}

async function applyLaneChanges(supabase: SupabaseClient, draft: Draft, changes: { pick: DraftPick; lane: Role | null }[]) {
  for (const { pick, lane } of changes) {
    let query = supabase.from("coach_draft_picks").update({ lane }).eq("id", pick.id)
    query = pick.lane === null ? query.is("lane", null) : query.eq("lane", pick.lane)
    const { data, error } = await query.select("id").maybeSingle()
    if (error) return fromDb<LaneChange[]>(error)
    if (!data) return rejected<LaneChange[]>("stale")
  }
  await supabase.from("game_sessions").update({ updated_at: new Date().toISOString() }).eq("id", draft.session.id).eq("status", "coach_draft")
  return {
    ok: true as const,
    value: changes.map(({ pick, lane }) => ({ pickId: pick.id, playerId: pick.player_id, lane })),
  }
}

// Picking a lane a teammate already holds swaps the two, like a role swap in champ select.
export async function assignLane(
  supabase: SupabaseClient,
  viewer: LobbyViewer,
  draft: Draft,
  playerId: string,
  lane: Role
): Promise<DraftOutcome<LaneChange[]>> {
  if (draft.session.status !== "coach_draft") return rejected("not_drafting")
  if (draft.session.champion_draft_at) return rejected("teams_locked")
  if (draft.picks.length < 10) return rejected("picks_missing", "Lanes open once all ten players are drafted.")
  const pick = draft.picks.find((p) => p.player_id === playerId)
  if (!pick) return rejected("player_unavailable", "That player is not in this draft.")
  if (!canSetLanes(viewer, draft.session, pick.side)) return rejected("not_a_coach", "You can only set lanes for your own team.")
  if (pick.lane === lane) return { ok: true, value: [] }

  const holder = draft.picks.find((p) => p.side === pick.side && p.lane === lane && p.id !== pick.id)
  const changes = holder ? [{ pick: holder, lane: pick.lane }, { pick, lane }] : [{ pick, lane }]
  return applyLaneChanges(supabase, draft, changes)
}

export async function autoAssignLanes(supabase: SupabaseClient, viewer: LobbyViewer, draft: Draft): Promise<DraftOutcome<LaneChange[]>> {
  if (draft.session.status !== "coach_draft") return rejected("not_drafting")
  if (draft.session.champion_draft_at) return rejected("teams_locked")
  if (draft.picks.length < 10) return rejected("picks_missing", "Lanes open once all ten players are drafted.")
  const mine = sideOfCoach(draft.session, viewer.userId)
  const sides: Side[] = mine ? [mine] : viewer.isAdmin ? ["blue", "red"] : []
  if (sides.length === 0) return rejected("not_a_coach", "Only the coaches can set lanes.")

  const changes: { pick: DraftPick; lane: Role }[] = []
  for (const side of sides) {
    const team = draft.picks.filter((p) => p.side === side)
    const free = shuffled(LANES.filter((lane) => !team.some((p) => p.lane === lane)))
    team.filter((p) => p.lane === null).forEach((pick, i) => {
      if (free[i]) changes.push({ pick, lane: free[i] })
    })
  }
  if (changes.length === 0) return { ok: true, value: [] }
  return applyLaneChanges(supabase, draft, changes)
}

export function draftError(code: CoachDraftErrorCode | "server", message?: string) {
  if (code === "server") return { status: 500, error: message ?? "The draft scribe dropped his quill. Try again.", code }
  const entry = COACH_DRAFT_ERRORS[code]
  return { status: entry.status, error: message ?? entry.message, code }
}
