import type { SupabaseClient } from "@supabase/supabase-js"
import { betNet, multiplier } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import {
  bettorFor,
  loadBettors,
  loadMarketSession,
  loadSessionBets,
  seatedSide,
  winnerOf,
  type MarketSessionRow,
} from "@/lib/betting/server/rows"
import type {
  BetRow,
  Bettor,
  MarketBet,
  MarketResult,
  MarketSession,
  MarketSnapshot,
  ResultHighlight,
  RulesVersion,
} from "@/lib/betting/types"

const SETTLED_STATUSES = ["blue_win", "red_win", "canceled", "expired"]

function toMarketBet(row: BetRow, bettor: Bettor): MarketBet {
  return {
    ...row,
    discord_username: bettor.discord_username,
    discord_avatar_url: bettor.discord_avatar_url,
    name: bettor.name,
    net: betNet(row),
    whale: row.amount >= BET_RULES.whaleAmount,
  }
}

function toSession(row: MarketSessionRow | null, version: RulesVersion): MarketSession | null {
  if (!row) return null
  const endsAt = row.betting_ends_at ? new Date(row.betting_ends_at).getTime() : null
  const openedAt = row.betting_opened_at
    ? new Date(row.betting_opened_at).getTime()
    : endsAt != null
      ? endsAt - BET_RULES.windowSeconds * 1000
      : null
  return {
    id: row.id,
    status: row.status,
    betting_ends_at: row.betting_ends_at,
    betting_opened_at: openedAt != null ? new Date(openedAt).toISOString() : null,
    early_ends_at: version === 2 && openedAt != null ? new Date(openedAt + BET_RULES.earlySeconds * 1000).toISOString() : null,
    winner: winnerOf(row.status),
  }
}

function highlight(bet: MarketBet): ResultHighlight {
  return {
    user_id: bet.user_id,
    name: bet.name,
    avatar_url: bet.discord_avatar_url,
    net: bet.net ?? 0,
    amount: bet.amount,
    side: bet.side,
  }
}

export function summarizeResult(session: MarketSession | null, bets: MarketBet[]): MarketResult | null {
  const settled = bets.filter((b) => b.status !== "pending")
  const isSettledSession = !!session && SETTLED_STATUSES.includes(session.status)
  if (!isSettledSession && (settled.length === 0 || settled.length < bets.length)) return null

  const won = settled.filter((b) => b.status === "won")
  const lost = settled.filter((b) => b.status === "lost")
  const refunded = settled.length > 0 && won.length === 0 && lost.length === 0
  const top = won.reduce<MarketBet | null>((best, b) => (!best || (b.net ?? 0) > (best.net ?? 0) ? b : best), null)
  const worst = lost.reduce<MarketBet | null>((low, b) => (!low || (b.net ?? 0) < (low.net ?? 0) ? b : low), null)

  return {
    winner: session?.winner ?? (won[0]?.side ?? null),
    refunded,
    total_pool: won.concat(lost).reduce((sum, b) => sum + b.amount, 0),
    top_winner: top ? highlight(top) : null,
    biggest_loser: worst ? highlight(worst) : null,
    all_in_losers: lost.filter((b) => b.all_in).map((b) => b.name),
    insurance_paid: lost.filter((b) => b.insured).reduce((sum, b) => sum + (b.payout ?? 0), 0),
    bonus_paid: won.reduce((sum, b) => sum + b.bonus, 0),
  }
}

export async function buildMarketSnapshot(
  supabase: SupabaseClient,
  sessionId: string,
  viewerPromise: Promise<string | null>
): Promise<MarketSnapshot> {
  const [{ rows, version }, sessionRow, viewer, viewerSide] = await Promise.all([
    loadSessionBets(supabase, sessionId),
    loadMarketSession(supabase, sessionId),
    viewerPromise,
    viewerPromise.then((id) => seatedSide(supabase, sessionId, id)),
  ])
  const bettors = await loadBettors(
    supabase,
    rows.map((r) => r.user_id)
  )
  const all = rows
    .map((row) => toMarketBet(row, bettorFor(bettors, row.user_id)))
    .sort((a, b) => (b.raised_at ?? b.created_at).localeCompare(a.raised_at ?? a.created_at))
  const active = all.filter((b) => b.status !== "refunded")
  const blue = active.filter((b) => b.side === "blue")
  const red = active.filter((b) => b.side === "red")
  const blueTotal = blue.reduce((sum, b) => sum + b.amount, 0)
  const redTotal = red.reduce((sum, b) => sum + b.amount, 0)
  const total = blueTotal + redTotal
  const session = toSession(sessionRow, version)

  return {
    blue_total: blueTotal,
    red_total: redTotal,
    total,
    blue_multiplier: multiplier(total, blueTotal),
    red_multiplier: multiplier(total, redTotal),
    bet_count: active.length,
    blue_count: blue.length,
    red_count: red.length,
    refunded_count: all.length - active.length,
    user_bet: viewer ? all.find((b) => b.user_id === viewer) ?? null : null,
    bets: active,
    entries: all,
    rules_version: version,
    session,
    result: summarizeResult(session, all),
    server_time: new Date().toISOString(),
    viewer_side: viewerSide,
  }
}
