import type { SupabaseClient } from "@supabase/supabase-js"
import type { ChampionLookup } from "@/lib/pages/champion-index"
import type { HistoryGame, HistoryPlayer, PlayerRef } from "@/lib/pages/types"
import type { GameMode, Role, Side } from "@/lib/types"

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]
const MODES: GameMode[] = ["standard", "coach_draft", "vainqueur"]

interface GameRow {
  id: string
  played_at: string
  winner_side: string
  roster: { player_id: string; side: string; lane: string; champion: string }[] | null
}

export interface Cursor {
  at: string
  id: string
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.at}|${cursor.id}`, "utf8").toString("base64url")
}

// The cursor is interpolated into a PostgREST filter: only canonical timestamps and uuids get through.
const CURSOR_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const CURSOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null
  try {
    const [at, id, ...rest] = Buffer.from(raw, "base64url").toString("utf8").split("|")
    if (rest.length > 0 || !at || !id || !CURSOR_AT.test(at) || Number.isNaN(Date.parse(at)) || !CURSOR_ID.test(id)) return null
    return { at, id }
  } catch {
    return null
  }
}

export async function loadHistoryPage(
  supabase: SupabaseClient,
  options: { limit: number; cursor: Cursor | null; playerId: string | null }
): Promise<{ rows: GameRow[]; next: Cursor | null }> {
  const columns = options.playerId
    ? "id, played_at, winner_side, roster:game_players(player_id, side, lane, champion), seat:game_players!inner(player_id)"
    : "id, played_at, winner_side, roster:game_players(player_id, side, lane, champion)"
  let query = supabase
    .from("games")
    .select(columns)
    .order("played_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit + 1)
  if (options.playerId) query = query.eq("seat.player_id", options.playerId)
  if (options.cursor) {
    const { at, id } = options.cursor
    query = query.or(`played_at.lt."${at}",and(played_at.eq."${at}",id.lt.${id})`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as GameRow[]
  const page = rows.slice(0, options.limit)
  const last = page[page.length - 1]
  return { rows: page, next: rows.length > options.limit && last ? { at: last.played_at, id: last.id } : null }
}

interface SessionExtras {
  mode: GameMode
  pool: number
  bettors: number
  decrees: number
}

// One query per table for the whole page, never one per game.
export async function loadSessionExtras(supabase: SupabaseClient, gameIds: string[]): Promise<Map<string, SessionExtras>> {
  const extras = new Map<string, SessionExtras>()
  if (gameIds.length === 0) return extras
  const { data: sessions } = await supabase.from("game_sessions").select("id, game_id, game_mode").in("game_id", gameIds)
  const sessionRows = (sessions ?? []) as { id: string; game_id: string; game_mode: string }[]
  if (sessionRows.length === 0) return extras

  const sessionIds = sessionRows.map((s) => s.id)
  const [bets, decrees] = await Promise.all([
    supabase.from("bets").select("session_id, user_id, amount, status").in("session_id", sessionIds),
    supabase.from("chaos_actions").select("session_id, status").in("session_id", sessionIds),
  ])

  const pool = new Map<string, { total: number; users: Set<string> }>()
  for (const bet of (bets.data ?? []) as { session_id: string; user_id: string; amount: number; status: string }[]) {
    if (bet.status === "refunded") continue
    const entry = pool.get(bet.session_id) ?? { total: 0, users: new Set<string>() }
    entry.total += Number(bet.amount) || 0
    entry.users.add(bet.user_id)
    pool.set(bet.session_id, entry)
  }
  const decreeCount = new Map<string, number>()
  for (const decree of (decrees.data ?? []) as { session_id: string; status: string }[]) {
    if (decree.status === "refunded") continue
    decreeCount.set(decree.session_id, (decreeCount.get(decree.session_id) ?? 0) + 1)
  }

  for (const session of sessionRows) {
    const bettingPool = pool.get(session.id)
    extras.set(session.game_id, {
      mode: MODES.includes(session.game_mode as GameMode) ? (session.game_mode as GameMode) : "standard",
      pool: bettingPool?.total ?? 0,
      bettors: bettingPool?.users.size ?? 0,
      decrees: decreeCount.get(session.id) ?? 0,
    })
  }
  return extras
}

// The Tribunal ships in its own migration: until it lands (or if the read fails) the games simply have no verdict.
export async function loadVerdicts(
  supabase: SupabaseClient,
  gameIds: string[]
): Promise<Map<string, { mvp: string[]; inter: string[] }>> {
  const verdicts = new Map<string, { mvp: string[]; inter: string[] }>()
  if (gameIds.length === 0) return verdicts
  const { data, error } = await supabase
    .from("post_game_votes")
    .select("game_id, status, summary")
    .in("game_id", gameIds)
    .eq("status", "settled")
  if (error) return verdicts
  for (const row of (data ?? []) as { game_id: string | null; summary: unknown }[]) {
    if (!row.game_id || typeof row.summary !== "object" || row.summary === null) continue
    const summary = row.summary as { mvp?: { names?: unknown }; inter?: { names?: unknown } }
    const names = (value: unknown) => (Array.isArray(value) ? value.filter((n): n is string => typeof n === "string") : [])
    const mvp = names(summary.mvp?.names)
    const inter = names(summary.inter?.names)
    if (mvp.length || inter.length) verdicts.set(row.game_id, { mvp, inter })
  }
  return verdicts
}

const isSide = (value: string): value is Side => value === "blue" || value === "red"

export function toHistoryGame(
  row: GameRow,
  players: Map<string, PlayerRef>,
  internalOf: ChampionLookup,
  extras: SessionExtras | undefined,
  verdict: { mvp: string[]; inter: string[] } | undefined
): HistoryGame | null {
  if (!isSide(row.winner_side)) return null
  const roster: HistoryPlayer[] = (row.roster ?? [])
    .filter((seat) => isSide(seat.side) && (LANE_ORDER as string[]).includes(seat.lane))
    .map((seat) => ({
      playerId: seat.player_id,
      name: players.get(seat.player_id)?.name ?? "A forgotten soul",
      side: seat.side as Side,
      lane: seat.lane as Role,
      champion: seat.champion,
      internal: internalOf(seat.champion),
    }))
    .sort((x, y) => LANE_ORDER.indexOf(x.lane) - LANE_ORDER.indexOf(y.lane))
  return {
    id: row.id,
    playedAt: row.played_at,
    winner: row.winner_side,
    players: roster,
    session: extras ?? null,
    verdict: verdict ?? null,
  }
}
