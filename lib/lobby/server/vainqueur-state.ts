import type { SupabaseClient } from "@supabase/supabase-js"
import { winnerOf } from "@/lib/session/constants"
import type { PlayerRef, VainqueurView } from "@/lib/lobby/types"
import type { SessionStatus, Side } from "@/lib/types"

interface DbError {
  code?: string
  message?: string
}

export interface StateRow {
  id: string
  is_active: boolean
  winning_player_ids: string[] | null
  losing_player_ids: string[] | null
  loser_volunteers: string[] | null
  last_session_id: string | null
  updated_at: string
}

export type StatePatch = Partial<Omit<StateRow, "id" | "updated_at">>

export interface LastGame {
  id: string
  status: SessionStatus
  createdBy: string | null
  winner: Side | null
  winners: string[]
  losers: string[]
}

const STATE_TABLE = "vainqueur_state"

// Until phase10_lobby.sql dedupes it, the "singleton" can have several rows. The most recently written row is the
// truth (that is also the one declare_winner just filled); writes are mirrored so every row agrees.
export async function loadStateRows(supabase: SupabaseClient): Promise<{ rows: StateRow[]; error: DbError | null }> {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
  return { rows: (data ?? []) as StateRow[], error }
}

export async function ensureStateRow(supabase: SupabaseClient): Promise<{ rows: StateRow[]; error: DbError | null }> {
  const loaded = await loadStateRows(supabase)
  if (loaded.error || loaded.rows.length > 0) return loaded
  const { error } = await supabase.from(STATE_TABLE).insert({ is_active: false })
  if (error && error.code !== "23505") return { rows: [], error }
  return loadStateRows(supabase)
}

export type WriteResult = { row: StateRow; conflict: false; error: null } | { row: null; conflict: boolean; error: DbError | null }

// Compare-and-set on the canonical row: a concurrent write makes this one fail instead of being overwritten.
export async function writeState(supabase: SupabaseClient, rows: StateRow[], patch: StatePatch): Promise<WriteResult> {
  const current = rows[0]
  if (!current) return { row: null, conflict: true, error: null }
  const next = { ...patch, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .update(next)
    .eq("id", current.id)
    .eq("updated_at", current.updated_at)
    .select("*")
    .maybeSingle()
  if (error) return { row: null, conflict: false, error }
  if (!data) return { row: null, conflict: true, error: null }
  if (rows.length > 1) await supabase.from(STATE_TABLE).update(next).neq("id", current.id)
  return { row: data as StateRow, conflict: false, error: null }
}

export type Mutation = { patch: StatePatch } | { done: true } | { status: number; error: string; code?: string }

export type MutationOutcome =
  | { ok: true; changed: boolean; row: StateRow | null }
  | { ok: false; status: number; error: string; code?: string }

// Read, decide, compare-and-set; retried a few times when someone else wrote in between.
export async function mutateState(
  supabase: SupabaseClient,
  decide: (state: StateRow) => Mutation | Promise<Mutation>,
  attempts = 4
): Promise<MutationOutcome> {
  for (let i = 0; i < attempts; i++) {
    const { rows, error } = await ensureStateRow(supabase)
    if (error) return { ok: false, status: 500, error: error.message ?? "Could not read the rotation" }
    const current = rows[0]
    if (!current) return { ok: false, status: 500, error: "The rotation could not be initialised" }
    const decision = await decide(current)
    if ("error" in decision) return { ok: false, status: decision.status, error: decision.error, code: decision.code }
    if ("done" in decision) return { ok: true, changed: false, row: current }
    const result = await writeState(supabase, rows, decision.patch)
    if (result.error) return { ok: false, status: 500, error: result.error.message ?? "Could not update the rotation" }
    if (result.row) return { ok: true, changed: true, row: result.row }
  }
  return { ok: false, status: 409, error: "The rotation is busy. Try again.", code: "stale" }
}

export async function loadLastGame(supabase: SupabaseClient, sessionId: string | null): Promise<LastGame | null> {
  if (!sessionId) return null
  const { data } = await supabase
    .from("game_sessions")
    .select("id, status, created_by, session_assignments ( player_id, side )")
    .eq("id", sessionId)
    .maybeSingle()
  if (!data) return null
  const status = data.status as SessionStatus
  const winner = winnerOf(status)
  const assignments = (data.session_assignments ?? []) as { player_id: string; side: Side }[]
  return {
    id: data.id as string,
    status,
    createdBy: (data.created_by as string | null) ?? null,
    winner,
    winners: winner ? assignments.filter((a) => a.side === winner).map((a) => a.player_id) : [],
    losers: winner ? assignments.filter((a) => a.side !== winner).map((a) => a.player_id) : [],
  }
}

export function satOutOf(state: StateRow, last: LastGame | null): string[] {
  const holding = new Set(state.winning_player_ids ?? [])
  return (last?.winners ?? []).filter((id) => !holding.has(id))
}

export async function playerRefs(supabase: SupabaseClient, ids: string[]): Promise<Map<string, PlayerRef & { active: boolean }>> {
  const unique = [...new Set(ids)]
  const refs = new Map<string, PlayerRef & { active: boolean }>()
  if (unique.length === 0) return refs
  const { data } = await supabase.from("players").select("id, name, auth_user_id, is_active").in("id", unique)
  for (const p of (data ?? []) as { id: string; name: string; auth_user_id: string | null; is_active: boolean }[]) {
    refs.set(p.id, { id: p.id, name: p.name, userId: p.auth_user_id, active: p.is_active })
  }
  return refs
}

export async function buildView(supabase: SupabaseClient, state: StateRow | null): Promise<VainqueurView> {
  if (!state) {
    return { active: false, lastSessionId: null, lastWinner: null, hostUserId: null, winners: [], satOut: [], losers: [], volunteers: [], updatedAt: null }
  }
  const last = state.is_active ? await loadLastGame(supabase, state.last_session_id) : null
  const winners = state.winning_player_ids ?? []
  const losers = state.losing_player_ids ?? []
  const satOut = satOutOf(state, last)
  const refs = await playerRefs(supabase, [...winners, ...losers, ...satOut])
  // Benched players are left out exactly like the rotation leaves them out, so the board matches what it deals.
  const toRefs = (ids: string[]) =>
    ids
      .map((id) => refs.get(id))
      .filter((r): r is PlayerRef & { active: boolean } => !!r?.active)
      .map(({ id, name, userId }) => ({ id, name, userId }))
  return {
    active: state.is_active,
    lastSessionId: state.last_session_id,
    lastWinner: last?.winner ?? null,
    hostUserId: last?.createdBy ?? null,
    winners: toRefs(winners),
    satOut: toRefs(satOut),
    losers: toRefs(losers),
    volunteers: (state.loser_volunteers ?? []).filter((id) => losers.includes(id)),
    updatedAt: state.updated_at,
  }
}
