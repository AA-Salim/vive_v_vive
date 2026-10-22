import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { BET_RULES } from "@/lib/betting/rules"
import type { BetRow, BetStatus, Bettor, RulesVersion } from "@/lib/betting/types"
import type { SessionStatus, Side } from "@/lib/types"

const LEGACY_COLUMNS = "id, session_id, user_id, side, amount, payout, status, insured, created_at"
const V2_COLUMNS = `${LEGACY_COLUMNS}, scheme, premium, coverage_pct, early_amount, all_in, bonus, raises, raised_at`
const STATUSES: BetStatus[] = ["pending", "won", "lost", "refunded"]
const PAGE_SIZE = 1000
const MAX_PAGES = 20

type Raw = Record<string, unknown>

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function normalizeBet(raw: Raw): BetRow {
  const scheme = raw.scheme === "v2" ? "v2" : "legacy"
  const insured = raw.insured === true
  const status = STATUSES.includes(raw.status as BetStatus) ? (raw.status as BetStatus) : "pending"
  return {
    id: String(raw.id),
    session_id: String(raw.session_id),
    user_id: String(raw.user_id),
    side: raw.side === "red" ? "red" : "blue",
    amount: num(raw.amount),
    payout: raw.payout == null ? null : num(raw.payout),
    status,
    insured,
    created_at: String(raw.created_at),
    scheme,
    premium: scheme === "v2" ? num(raw.premium) : insured ? BET_RULES.legacyPremium : 0,
    coverage_pct: scheme === "v2" ? num(raw.coverage_pct) : insured ? BET_RULES.legacyCoveragePct : 0,
    early_amount: num(raw.early_amount),
    all_in: raw.all_in === true,
    bonus: num(raw.bonus),
    raises: num(raw.raises),
    raised_at: typeof raw.raised_at === "string" ? raw.raised_at : null,
  }
}

export async function loadSessionBets(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ rows: BetRow[]; version: RulesVersion }> {
  const v2 = await supabase.from("bets").select(V2_COLUMNS).eq("session_id", sessionId)
  if (!v2.error) return { rows: ((v2.data ?? []) as Raw[]).map(normalizeBet), version: 2 }
  if (!isMissingSchema(v2.error)) throw new Error(v2.error.message)
  const legacy = await supabase.from("bets").select(LEGACY_COLUMNS).eq("session_id", sessionId)
  if (legacy.error) throw new Error(legacy.error.message)
  return { rows: ((legacy.data ?? []) as Raw[]).map(normalizeBet), version: 1 }
}

export async function loadSettledBets(
  supabase: SupabaseClient,
  since: string | null,
  until: string | null = null
): Promise<{ rows: BetRow[]; version: RulesVersion }> {
  let version: RulesVersion = 2
  const rows: BetRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const columns: string = version === 2 ? V2_COLUMNS : LEGACY_COLUMNS
    let query = supabase
      .from("bets")
      .select(columns)
      .in("status", ["won", "lost", "refunded"])
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (since) query = query.gte("created_at", since)
    if (until) query = query.lt("created_at", until)
    const { data, error } = await query
    if (error) {
      if (version === 2 && page === 0 && isMissingSchema(error)) {
        version = 1
        page = -1
        continue
      }
      throw new Error(error.message)
    }
    const batch = (data ?? []) as unknown as Raw[]
    rows.push(...batch.map(normalizeBet))
    if (batch.length < PAGE_SIZE) break
  }
  return { rows, version }
}

export async function loadBettors(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, Bettor>> {
  const ids = [...new Set(userIds)]
  const map = new Map<string, Bettor>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from("user_profiles")
    .select("id, discord_username, discord_avatar_url, players:player_id ( name )")
    .in("id", ids)
  for (const row of (data ?? []) as Raw[]) {
    const player = row.players as { name?: string } | { name?: string }[] | null
    const playerName = Array.isArray(player) ? player[0]?.name : player?.name
    const username = typeof row.discord_username === "string" ? row.discord_username : "Unknown"
    map.set(String(row.id), {
      user_id: String(row.id),
      name: playerName || username,
      discord_username: username,
      discord_avatar_url: typeof row.discord_avatar_url === "string" ? row.discord_avatar_url : null,
    })
  }
  return map
}

export function bettorFor(map: Map<string, Bettor>, userId: string): Bettor {
  return map.get(userId) ?? { user_id: userId, name: "Unknown", discord_username: "Unknown", discord_avatar_url: null }
}

export interface MarketSessionRow {
  id: string
  status: SessionStatus
  betting_ends_at: string | null
  betting_opened_at: string | null
}

export async function loadMarketSession(supabase: SupabaseClient, sessionId: string): Promise<MarketSessionRow | null> {
  const withOpened = await supabase
    .from("game_sessions")
    .select("id, status, betting_ends_at, betting_opened_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (!withOpened.error) return (withOpened.data as MarketSessionRow | null) ?? null
  if (!isMissingSchema(withOpened.error)) throw new Error(withOpened.error.message)
  const legacy = await supabase
    .from("game_sessions")
    .select("id, status, betting_ends_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (legacy.error) throw new Error(legacy.error.message)
  return legacy.data ? { ...(legacy.data as Omit<MarketSessionRow, "betting_opened_at">), betting_opened_at: null } : null
}

export function winnerOf(status: SessionStatus | null | undefined): Side | null {
  if (status === "blue_win") return "blue"
  if (status === "red_win") return "red"
  return null
}

// Mirrors bet_v2_player_side() in supabase/phase10_betting.sql: both account links count, Blue wins a tie.
export async function seatedSide(supabase: SupabaseClient, sessionId: string, userId: string | null): Promise<Side | null> {
  if (!userId) return null
  const [{ data: profile }, { data: linked }] = await Promise.all([
    supabase.from("user_profiles").select("player_id").eq("id", userId).maybeSingle(),
    supabase.from("players").select("id").eq("auth_user_id", userId),
  ])
  const playerIds = [profile?.player_id as string | null | undefined, ...((linked ?? []) as { id: string }[]).map((p) => p.id)].filter(
    (id): id is string => !!id
  )
  if (playerIds.length === 0) return null
  const { data: seats } = await supabase
    .from("session_assignments")
    .select("side")
    .eq("session_id", sessionId)
    .in("player_id", playerIds)
  const sides = ((seats ?? []) as { side?: unknown }[]).map((row) => row.side)
  if (sides.includes("blue")) return "blue"
  if (sides.includes("red")) return "red"
  return null
}

export async function viewerId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getClaims()
    const sub = data?.claims?.sub
    return typeof sub === "string" ? sub : null
  } catch {
    return null
  }
}
