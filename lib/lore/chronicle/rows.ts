import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeBet } from "@/lib/betting/server/rows"
import type { BetRow } from "@/lib/betting/types"
import { isMissingSchema } from "@/lib/db-errors"
import type { Role, Side } from "@/lib/types"

type One<T> = T | T[] | null | undefined

export function one<T>(value: One<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export interface GameRow {
  id: string
  played_at: string
  winner_side: Side
  game_players: { player_id: string; side: Side; lane: Role; champion: string; players: One<{ name: string }> }[] | null
}

export interface SessionRow {
  id: string
  status: string
  game_id: string | null
  created_at: string
}

export interface ProfileRow {
  id: string
  discord_username: string | null
  players: One<{ name: string }>
}

export interface ChaosRow {
  session_id: string
  user_id: string
  action_type: string
  cost: number
  status: string
}

export interface VerdictSummary {
  mvp?: { names?: unknown }
  inter?: { names?: unknown }
}

export interface VoteRow {
  session_id: string
  status: string
  mvp_player_ids: string[] | null
  inter_player_ids: string[] | null
  summary: VerdictSummary | null
}

export interface SalaxeGameRow {
  side: Side
  games: One<{ played_at: string; winner_side: Side }>
}

const BET_LEGACY = "id, session_id, user_id, side, amount, payout, status, insured, created_at"
const BET_V2 = `${BET_LEGACY}, scheme, premium, all_in`
const TX_PAGE = 1000
const TX_PAGES = 4

export async function loadBets(supabase: SupabaseClient, sessionIds: string[]): Promise<BetRow[]> {
  if (sessionIds.length === 0) return []
  const v2 = await supabase.from("bets").select(BET_V2).in("session_id", sessionIds)
  if (!v2.error) return ((v2.data ?? []) as unknown as Record<string, unknown>[]).map(normalizeBet)
  if (!isMissingSchema(v2.error)) return []
  const legacy = await supabase.from("bets").select(BET_LEGACY).in("session_id", sessionIds)
  return legacy.error ? [] : ((legacy.data ?? []) as unknown as Record<string, unknown>[]).map(normalizeBet)
}

export async function loadDecrees(supabase: SupabaseClient, sessionIds: string[]): Promise<ChaosRow[]> {
  if (sessionIds.length === 0) return []
  const { data, error } = await supabase
    .from("chaos_actions")
    .select("session_id, user_id, action_type, cost, status")
    .in("session_id", sessionIds)
  return error ? [] : ((data ?? []) as ChaosRow[])
}

// Null when the Tribunal migration is not applied yet.
export async function loadVotes(supabase: SupabaseClient, sessionIds: string[]): Promise<VoteRow[] | null> {
  if (sessionIds.length === 0) return []
  const { data, error } = await supabase
    .from("post_game_votes")
    .select("session_id, status, mvp_player_ids, inter_player_ids, summary")
    .in("session_id", sessionIds)
  if (error) return isMissingSchema(error) ? null : []
  return (data ?? []) as VoteRow[]
}

export async function loadNetByUser(supabase: SupabaseClient, from: string, to: string): Promise<Map<string, number>> {
  const net = new Map<string, number>()
  for (let page = 0; page < TX_PAGES; page++) {
    const { data, error } = await supabase
      .from("point_transactions")
      .select("user_id, amount")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true })
      .range(page * TX_PAGE, page * TX_PAGE + TX_PAGE - 1)
    if (error || !data) break
    for (const row of data as { user_id: string; amount: number }[]) {
      net.set(row.user_id, (net.get(row.user_id) ?? 0) + (Number(row.amount) || 0))
    }
    if (data.length < TX_PAGE) break
  }
  return net
}

export async function loadSalaxeGames(supabase: SupabaseClient, playerId: string | null): Promise<SalaxeGameRow[]> {
  if (!playerId) return []
  const { data, error } = await supabase
    .from("game_players")
    .select("side, games:game_id (played_at, winner_side)")
    .eq("player_id", playerId)
  return error ? [] : ((data ?? []) as unknown as SalaxeGameRow[])
}

export function verdictNames(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : []
}
