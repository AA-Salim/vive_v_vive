import type { SessionStatus, Side } from "@/lib/types"

export type BetStatus = "pending" | "won" | "lost" | "refunded"
export type BetScheme = "legacy" | "v2"
export type RulesVersion = 1 | 2

export interface BetRow {
  id: string
  session_id: string
  user_id: string
  side: Side
  amount: number
  payout: number | null
  status: BetStatus
  insured: boolean
  created_at: string
  scheme: BetScheme
  premium: number
  coverage_pct: number
  early_amount: number
  all_in: boolean
  bonus: number
  raises: number
  raised_at: string | null
}

export interface Bettor {
  user_id: string
  name: string
  discord_username: string
  discord_avatar_url: string | null
}

export interface MarketBet extends BetRow {
  discord_username: string
  discord_avatar_url: string | null
  name: string
  net: number | null
  whale: boolean
}

export interface MarketSession {
  id: string
  status: SessionStatus
  betting_opened_at: string | null
  betting_ends_at: string | null
  early_ends_at: string | null
  winner: Side | null
}

export interface ResultHighlight {
  user_id: string
  name: string
  avatar_url: string | null
  net: number
  amount: number
  side: Side
}

export interface MarketResult {
  winner: Side | null
  refunded: boolean
  total_pool: number
  top_winner: ResultHighlight | null
  biggest_loser: ResultHighlight | null
  all_in_losers: string[]
  insurance_paid: number
  bonus_paid: number
}

export interface MarketSnapshot {
  blue_total: number
  red_total: number
  total: number
  blue_multiplier: number | null
  red_multiplier: number | null
  bet_count: number
  blue_count: number
  red_count: number
  refunded_count: number
  user_bet: MarketBet | null
  bets: MarketBet[]
  entries: MarketBet[]
  rules_version: RulesVersion
  session: MarketSession | null
  result: MarketResult | null
  server_time: string
}

export interface PlaceBetInput {
  side: Side
  amount: number
  insure: boolean
  allIn: boolean
  rules: RulesVersion
  // The stake the slip was built on (0 for a new bet) and the premium it showed: the server rejects the bet
  // if either is out of date instead of charging something the bettor never saw.
  current: number
  maxPremium: number | null
}

export interface PlaceBetResult {
  bet: Partial<BetRow> | null
  staked: number
  premium: number
  premium_pct?: number
  early: boolean
  raised: boolean
  all_in: boolean
  balance: number | null
  rules: RulesVersion
}

export interface InsureBetResult {
  bet: Partial<BetRow> | null
  premium: number
  premium_pct?: number
  balance: number | null
  rules: RulesVersion
}

export type HallScope = "act" | "all"

export interface HallBettor {
  user_id: string
  name: string
  avatar_url: string | null
}

export interface HallBetRecord extends HallBettor {
  bet_id: string
  amount: number
  net: number
  side: Side
  status: BetStatus
  at: string
}

export interface HallStanding extends HallBettor {
  bets: number
  won: number
  lost: number
  refunded: number
  net: number
  volume: number
  best_win: number
  worst_loss: number
  insured: number
  recovered: number
  all_ins: number
  bonus: number
}

export interface HallRecentBet extends HallBettor {
  bet_id: string
  side: Side
  amount: number
  net: number
  status: BetStatus
  insured: boolean
  all_in: boolean
  early: boolean
  at: string
}

export interface HallOfFame {
  scope: HallScope
  act: { number: number; name: string; started_at: string } | null
  rules_version: RulesVersion
  totals: {
    bets: number
    bettors: number
    wagered: number
    recovered: number
    bonus: number
    all_ins: number
  }
  records: {
    chosen: HallStanding | null
    fool: HallStanding | null
    heist: HallBetRecord | null
    throw: HallBetRecord | null
    high_roller: HallBetRecord | null
    degenerate: HallStanding | null
    oracle: (HallStanding & { win_rate: number }) | null
    angel: HallStanding | null
    boots: HallStanding | null
  }
  standings: HallStanding[]
  recent: HallRecentBet[]
}
