import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { loadAccounts, type Account } from "@/lib/duels/server/accounts"
import type { LiveActor } from "@/lib/live/events"
import type { DuelStatus, DuelView, Duelist } from "@/lib/duels/types"
import type { SessionStatus, Side } from "@/lib/types"

export interface DuelRow {
  id: string
  session_id: string
  challenger_id: string
  opponent_id: string | null
  is_open: boolean
  challenger_side: Side
  stake: number
  status: DuelStatus
  winner_id: string | null
  winner_side: Side | null
  payout: number | null
  tax: number
  created_at: string
  responded_at: string | null
  settled_at: string | null
}

export interface DuelSessionRow {
  id: string
  status: SessionStatus
  betting_ends_at: string | null
  created_by: string | null
  game_id: string | null
}

const DUEL_COLUMNS =
  "id, session_id, challenger_id, opponent_id, is_open, challenger_side, stake, status, winner_id, winner_side, payout, tax, created_at, responded_at, settled_at"

const STATUSES: readonly DuelStatus[] = ["open", "accepted", "won", "lost", "declined", "withdrawn", "expired", "refunded"]

type Raw = Record<string, unknown>

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null)
const side = (value: unknown): Side | null => (value === "blue" || value === "red" ? value : null)

function int(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function normalizeDuel(raw: unknown): DuelRow | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Raw
  const id = str(r.id)
  const sessionId = str(r.session_id)
  const challengerId = str(r.challenger_id)
  const challengerSide = side(r.challenger_side)
  if (!id || !sessionId || !challengerId || !challengerSide) return null
  return {
    id,
    session_id: sessionId,
    challenger_id: challengerId,
    opponent_id: str(r.opponent_id),
    is_open: r.is_open === true,
    challenger_side: challengerSide,
    stake: int(r.stake),
    status: STATUSES.includes(r.status as DuelStatus) ? (r.status as DuelStatus) : "open",
    winner_id: str(r.winner_id),
    winner_side: side(r.winner_side),
    payout: r.payout == null ? null : int(r.payout),
    tax: int(r.tax),
    created_at: str(r.created_at) ?? new Date(0).toISOString(),
    responded_at: str(r.responded_at),
    settled_at: str(r.settled_at),
  }
}

export async function loadDuelSession(supabase: SupabaseClient, sessionId: string): Promise<DuelSessionRow | null> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("id, status, betting_ends_at, created_by, game_id")
    .eq("id", sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DuelSessionRow | null) ?? null
}

// null when the duels migration has not been applied yet.
export async function loadDuelRows(supabase: SupabaseClient, sessionId: string): Promise<DuelRow[] | null> {
  const { data, error } = await supabase
    .from("duels")
    .select(DUEL_COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
  if (error) {
    if (isMissingSchema(error)) return null
    throw new Error(error.message)
  }
  return ((data ?? []) as Raw[]).map(normalizeDuel).filter((row): row is DuelRow => row !== null)
}

export function loadDuelists(supabase: SupabaseClient, userIds: (string | null | undefined)[]): Promise<Map<string, Account>> {
  return loadAccounts(supabase, userIds)
}

export function duelistFor(map: Map<string, Duelist>, userId: string): Duelist {
  const found = map.get(userId)
  return found
    ? { userId: found.userId, name: found.name, avatarUrl: found.avatarUrl, playerId: found.playerId }
    : { userId, name: "Someone", avatarUrl: null, playerId: null }
}

export function actorOf(duelist: Duelist): LiveActor {
  return { userId: duelist.userId, name: duelist.name, avatarUrl: duelist.avatarUrl }
}

export function toDuelView(row: DuelRow, duelists: Map<string, Duelist>): DuelView {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    isOpen: row.is_open,
    stake: row.stake,
    challengerSide: row.challenger_side,
    challenger: duelistFor(duelists, row.challenger_id),
    opponent: row.opponent_id ? duelistFor(duelists, row.opponent_id) : null,
    winnerId: row.winner_id,
    winnerSide: row.winner_side,
    payout: row.payout,
    tax: row.tax,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    settledAt: row.settled_at,
  }
}

export async function viewerIdOf(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getClaims()
    const sub = data?.claims?.sub
    return typeof sub === "string" ? sub : null
  } catch {
    return null
  }
}
