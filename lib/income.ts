import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { fetchAllRows, QueryError } from "@/lib/pages/fetch-all"

// What a user really earned: wages, stipends, devotion, honors, perks and bounties the court paid for good,
// plus the net profit (payout minus stake) of every bet, duel, prophecy and King's Wager they won. A payout that
// only hands a stake back (refunds, a withdrawn duel, a lost bet's Guardian Angel cover) is never income, so
// staking and withdrawing the same points cannot inflate the total. Bet bonuses are already in the bet payout.

const INCOME_REASONS = new Set([
  "kiss_the_hand",
  "sing_his_praises",
  "riddle_bonus",
  "royal_favor",
  "title_perk",
  "title_tribute",
  "bounty_claimed",
])

// Credits that are neither income nor a market: the act's starting purse and the honors carried from the last act.
const GRANT_REASONS = new Set(["initial_grant", "act_carryover"])

export interface LedgerAmount {
  user_id: string
  amount: number
  reason: string
}

export interface Earnings {
  earned: number
  spent: number
}

export interface IncomeWindow {
  userId?: string
  since?: string
  until?: string
}

export function isIncomeReason(reason: string): boolean {
  if (reason.startsWith("bet_")) return false
  return reason.startsWith("game_") || reason.endsWith("_bonus") || INCOME_REASONS.has(reason)
}

export function ledgerIncome(rows: readonly LedgerAmount[]): number {
  return rows.reduce((sum, row) => (row.amount > 0 && isIncomeReason(row.reason) ? sum + row.amount : sum), 0)
}

interface Position {
  user_id: string | null
  stake: number
  payout: number | null
}

interface PositionSource {
  table: string
  columns: string
  userColumn: string
  statuses: string[]
  match: Record<string, string>
  // Duels and prophecies come with later migrations: a missing table is simply no positions.
  optional: boolean
}

const POSITION_SOURCES: PositionSource[] = [
  { table: "bets", columns: "user_id, stake:amount, payout", userColumn: "user_id", statuses: ["won"], match: {}, optional: false },
  {
    table: "duels",
    columns: "user_id:winner_id, stake, payout",
    userColumn: "winner_id",
    statuses: ["won", "lost"],
    match: {},
    optional: true,
  },
  { table: "prophecy_wagers", columns: "user_id, stake, payout", userColumn: "user_id", statuses: ["won"], match: {}, optional: true },
  {
    table: "chaos_actions",
    columns: "user_id, stake:cost, payout",
    userColumn: "user_id",
    statuses: ["won"],
    match: { action_type: "double_or_nothing" },
    optional: false,
  },
]

async function loadPositions(supabase: SupabaseClient, source: PositionSource, window: IncomeWindow): Promise<Position[]> {
  try {
    return await fetchAllRows<Position>((from, to) => {
      let query = supabase
        .from(source.table)
        .select(source.columns)
        .in("status", source.statuses)
        .match(window.userId ? { ...source.match, [source.userColumn]: window.userId } : source.match)
      if (window.since) query = query.gte("created_at", window.since)
      if (window.until) query = query.lte("created_at", window.until)
      return query.order("id").range(from, to).overrideTypes<Position[], { merge: false }>()
    })
  } catch (error) {
    if (source.optional && error instanceof QueryError && isMissingSchema(error.cause)) return []
    throw error
  }
}

// Net profit of the won market positions in the window, per user.
export async function loadMarketProfits(supabase: SupabaseClient, window: IncomeWindow = {}): Promise<Map<string, number>> {
  const sources = await Promise.all(POSITION_SOURCES.map((source) => loadPositions(supabase, source, window)))
  const profits = new Map<string, number>()
  for (const position of sources.flat()) {
    const profit = Math.max(0, Number(position.payout ?? 0) - Number(position.stake))
    if (!position.user_id || !Number.isFinite(profit) || profit === 0) continue
    profits.set(position.user_id, (profits.get(position.user_id) ?? 0) + profit)
  }
  return profits
}

// earned: real income. spent: what left for good (purchases, fees, lost stakes and pending ones), so that
// grants + earned - spent is exactly the net of the ledger.
export function summarizeEarnings(ledger: readonly LedgerAmount[], profits: ReadonlyMap<string, number>): Map<string, Earnings> {
  const totals = new Map<string, { income: number; grants: number; net: number }>()
  const entry = (userId: string) => {
    let current = totals.get(userId)
    if (!current) {
      current = { income: 0, grants: 0, net: 0 }
      totals.set(userId, current)
    }
    return current
  }
  for (const row of ledger) {
    const current = entry(row.user_id)
    current.net += row.amount
    if (row.amount <= 0) continue
    if (isIncomeReason(row.reason)) current.income += row.amount
    else if (GRANT_REASONS.has(row.reason)) current.grants += row.amount
  }
  for (const userId of profits.keys()) entry(userId)

  const result = new Map<string, Earnings>()
  for (const [userId, current] of totals) {
    const earned = current.income + (profits.get(userId) ?? 0)
    result.set(userId, { earned, spent: Math.max(0, current.grants + earned - current.net) })
  }
  return result
}
