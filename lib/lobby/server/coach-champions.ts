import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import type { LiveActor } from "@/lib/live/events"
import {
  sideForChampionPick,
  type ChampionDraftView,
  type ChampionPickView,
  type ChampionRequestView,
  type ChampionSlot,
} from "@/lib/lobby/champion-pick"
import { coachDraftCode, type CoachDraftErrorCode } from "@/lib/lobby/server/coach-errors"
import type { Role, SessionStatus, Side } from "@/lib/types"

type Outcome<T> = { ok: true; value: T } | { ok: false; code: CoachDraftErrorCode | "server"; message?: string }

interface DbError {
  code?: string
  message?: string
}

export interface ChampionPickResult {
  pickNumber: number
  side: Side
  playerId: string
  playerName: string
  playerUserId: string | null
  lane: Role
  champion: string
  championInternal: string
  pickedBy: string | null
  auto: boolean
  requested: boolean
  replayed: boolean
  completed: boolean
  dequeued: number
  nextSide: Side | null
  nextCoachId: string | null
}

export interface ChampionUndoResult {
  pickNumber: number
  side: Side
  playerName: string
  playerUserId: string | null
  champion: string
  otherCoachId: string | null
}

export interface ChampionRequestResult {
  playerName: string
  side: Side
  champion: string | null
  changed: boolean
  coachId: string | null
}

export interface ChampionOpenResult {
  opened: boolean
  turnSide: Side
  nextCoachId: string | null
}

const str = (value: unknown): string | null => (typeof value === "string" ? value : null)

function fromDb<T>(error: DbError): Outcome<T> {
  if (isMissingSchema(error)) return { ok: false, code: "champions_unavailable" }
  const code = coachDraftCode(error.message)
  return code ? { ok: false, code } : { ok: false, code: "server", message: error.message }
}

function toPick(row: Record<string, unknown>): ChampionPickResult {
  return {
    pickNumber: Number(row.pick_number),
    side: row.side as Side,
    playerId: String(row.player_id),
    playerName: str(row.player_name) ?? "A player",
    playerUserId: str(row.player_user_id),
    lane: row.lane as Role,
    champion: String(row.champion),
    championInternal: String(row.champion_internal),
    pickedBy: str(row.picked_by),
    auto: row.auto === true,
    requested: row.requested === true,
    replayed: row.replayed === true,
    completed: row.completed === true,
    dequeued: Number(row.dequeued) || 0,
    nextSide: (str(row.next_side) as Side | null) ?? null,
    nextCoachId: str(row.next_coach_id),
  }
}

// Null when champion select is not in this database yet: the caller keeps the random deal.
export async function openChampionSelect(
  supabase: SupabaseClient,
  sessionId: string,
  version: string
): Promise<Outcome<ChampionOpenResult> | null> {
  const { data, error } = await supabase.rpc("coach_champions_open", { p_session_id: sessionId, p_version: version })
  if (error) return isMissingSchema(error) ? null : fromDb(error)
  const row = data as Record<string, unknown>
  return {
    ok: true,
    value: { opened: row.opened === true, turnSide: (str(row.turn_side) as Side | null) ?? "blue", nextCoachId: str(row.next_coach_id) },
  }
}

// The lazy clock. Never throws: a failed tick only means the next read tries again.
export async function tickChampionSelect(supabase: SupabaseClient, sessionId: string): Promise<ChampionPickResult | null> {
  try {
    const { data, error } = await supabase.rpc("coach_champions_tick", { p_session_id: sessionId })
    if (error || !data || typeof data !== "object") return null
    return toPick(data as Record<string, unknown>)
  } catch {
    return null
  }
}

export async function pickChampion(
  supabase: SupabaseClient,
  sessionId: string,
  input: { playerId: string; champion: string; pickNumber: number }
): Promise<Outcome<ChampionPickResult>> {
  const { data, error } = await supabase.rpc("coach_champion_pick", {
    p_session_id: sessionId,
    p_player_id: input.playerId,
    p_champion: input.champion,
    p_pick_number: input.pickNumber,
  })
  if (error) return fromDb(error)
  return { ok: true, value: toPick(data as Record<string, unknown>) }
}

export async function undoChampion(supabase: SupabaseClient, sessionId: string): Promise<Outcome<ChampionUndoResult>> {
  const { data, error } = await supabase.rpc("coach_champion_undo", { p_session_id: sessionId })
  if (error) return fromDb(error)
  const row = data as Record<string, unknown>
  return {
    ok: true,
    value: {
      pickNumber: Number(row.pick_number),
      side: row.side as Side,
      playerName: str(row.player_name) ?? "a player",
      playerUserId: str(row.player_user_id),
      champion: String(row.champion),
      otherCoachId: str(row.other_coach_id),
    },
  }
}

export async function requestChampion(
  supabase: SupabaseClient,
  sessionId: string,
  champion: string | null
): Promise<Outcome<ChampionRequestResult>> {
  const { data, error } = await supabase.rpc("coach_champion_request", { p_session_id: sessionId, p_champion: champion })
  if (error) return fromDb(error)
  const row = data as Record<string, unknown>
  return {
    ok: true,
    value: {
      playerName: str(row.player_name) ?? "A player",
      side: row.side as Side,
      champion: str(row.champion),
      changed: row.changed === true,
      coachId: str(row.coach_id),
    },
  }
}

interface SessionRow {
  status: SessionStatus
  blue_coach_id: string | null
  red_coach_id: string | null
  champion_draft_at: string | null
  champion_turn_ends_at: string | null
}

interface SlotRow {
  player_id: string
  side: Side
  lane: Role | null
  pick_number: number
  players: { name: string; auth_user_id: string | null } | { name: string; auth_user_id: string | null }[] | null
}

const unsupported = (): ChampionDraftView => ({
  supported: false,
  status: null,
  open: false,
  blueCoachId: null,
  redCoachId: null,
  turn: null,
  slots: [],
  picks: [],
  requests: [],
  serverTime: new Date().toISOString(),
})

// Everything the board needs in one read. Requests come back filtered by row level security: a viewer only
// sees the wishes of their own team.
export async function loadChampionDraft(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ view: ChampionDraftView | null; error: string | null }> {
  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("status, blue_coach_id, red_coach_id, champion_draft_at, champion_turn_ends_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (error) return isMissingSchema(error) ? { view: unsupported(), error: null } : { view: null, error: error.message ?? "unreadable" }
  if (!session) return { view: null, error: null }

  const [slots, picks, requests] = await Promise.all([
    supabase.from("coach_draft_picks").select("player_id, side, lane, pick_number, players:player_id ( name, auth_user_id )").eq("session_id", sessionId),
    supabase
      .from("coach_champion_picks")
      .select("id, pick_number, side, player_id, lane, champion, champion_internal, picked_by, auto, requested, created_at")
      .eq("session_id", sessionId)
      .order("pick_number", { ascending: true }),
    supabase.from("coach_champion_requests").select("player_id, champion, champion_internal, updated_at").eq("session_id", sessionId),
  ])
  const failed = [slots.error, picks.error, requests.error].find((e) => e)
  if (failed) return isMissingSchema(failed) ? { view: unsupported(), error: null } : { view: null, error: failed.message ?? "unreadable" }

  const row = session as SessionRow
  const pickRows = (picks.data ?? []) as ChampionPickView[]
  const open = row.status === "coach_draft" && !!row.champion_draft_at
  const nextSide = open ? sideForChampionPick(pickRows.length + 1) : null
  const coachOf = (side: Side) => (side === "blue" ? row.blue_coach_id : row.red_coach_id)

  return {
    view: {
      supported: true,
      status: row.status,
      open,
      blueCoachId: row.blue_coach_id,
      redCoachId: row.red_coach_id,
      turn: nextSide
        ? { pickNumber: pickRows.length + 1, side: nextSide, coachId: coachOf(nextSide), endsAt: row.champion_turn_ends_at }
        : null,
      slots: ((slots.data ?? []) as SlotRow[])
        .sort((a, b) => a.pick_number - b.pick_number)
        .map((s): ChampionSlot => {
          const player = Array.isArray(s.players) ? s.players[0] : s.players
          return { player_id: s.player_id, name: player?.name ?? "Unknown", user_id: player?.auth_user_id ?? null, side: s.side, lane: s.lane }
        }),
      picks: pickRows,
      requests: (requests.data ?? []) as ChampionRequestView[],
      serverTime: new Date().toISOString(),
    },
    error: null,
  }
}

// Seats whose champion came from a coach (re-rolls and unlocks leave them alone). Empty when the migration is
// pending or the game had no champion select.
export async function coachPickedPlayerIds(supabase: SupabaseClient, sessionId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("coach_champion_picks").select("player_id, champion").eq("session_id", sessionId)
  if (error || !data) return new Map()
  return new Map((data as { player_id: string; champion: string }[]).map((r) => [r.player_id, r.champion]))
}

const notMe = (userId: string | null, actor: LiveActor | null) => (userId && userId !== actor?.userId ? userId : null)

// One champion landed (by a coach, or by the clock when actor is null). The last one also opens the draft.
export function announceChampionPick(sessionId: string, actor: LiveActor | null, pick: ChampionPickResult) {
  emitLive("coachdraft.champion", {
    sessionId,
    actor,
    data: {
      coachName: pick.auto ? null : (actor?.name ?? "A coach"),
      playerName: pick.playerName,
      champion: pick.champion,
      championInternal: pick.championInternal,
      side: pick.side,
      lane: pick.lane,
      pickNumber: pick.pickNumber,
      nextSide: pick.nextSide,
      auto: pick.auto,
      requested: pick.requested,
      completed: pick.completed,
      targetUserId: notMe(pick.playerUserId, actor),
      nextCoachUserId: notMe(pick.nextCoachId, actor),
    },
  })
  if (!pick.completed) return
  emitLive("session.status", { sessionId, actor, data: { from: "coach_draft", to: "draft", winner: null, coachPicked: true } })
  if (pick.dequeued > 0) emitLive("queue.changed", { actor, data: { action: "advanced", count: pick.dequeued }, persist: false })
}

export function announceChampionUndo(sessionId: string, actor: LiveActor | null, undo: ChampionUndoResult) {
  emitLive("coachdraft.champion_undo", {
    sessionId,
    actor,
    data: {
      coachName: actor?.name ?? "A coach",
      playerName: undo.playerName,
      champion: undo.champion,
      side: undo.side,
      pickNumber: undo.pickNumber,
      targetUserId: notMe(undo.playerUserId, actor),
      otherCoachUserId: notMe(undo.otherCoachId, actor),
    },
  })
}

// Requests stay inside the team: the broadcast names the player, never the champion, and only their coach
// gets a line for it.
export function announceChampionRequest(sessionId: string, actor: LiveActor | null, request: ChampionRequestResult) {
  if (!request.changed) return
  emitLive("coachdraft.request", {
    sessionId,
    actor,
    data: { playerName: request.playerName, side: request.side, pinned: !!request.champion, targetUserId: notMe(request.coachId, actor) },
    persist: false,
  })
}

export function announceTeamsLocked(sessionId: string, actor: LiveActor | null, opened: ChampionOpenResult) {
  if (!opened.opened) return
  emitLive("coachdraft.teams_locked", {
    sessionId,
    actor,
    data: { coachName: actor?.name ?? "A coach", firstSide: opened.turnSide, targetUserId: notMe(opened.nextCoachId, actor) },
  })
}
