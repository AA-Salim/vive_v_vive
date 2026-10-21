import type { Category } from "@/lib/prophecy/constants"
import type { Role, SessionStatus, Side } from "@/lib/types"

export type WagerStatus = "pending" | "won" | "lost" | "refunded"

export interface WagerView {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  market: Category
  playerId: string | null
  stake: number
  status: WagerStatus
  payout: number | null
  createdAt: string
}

export interface MarketPick {
  stake: number
  prophets: number
}

export interface MarketBook {
  market: Category
  pot: number
  prophets: number
  picks: Record<string, MarketPick>
}

export type MarketBooks = Record<Category, MarketBook>

export interface LegacyProphecyView {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  label: string
  description: string
  correct: boolean | null
}

export type VerdictOutcome = "decided" | "split" | "too_few" | "no_votes"

export interface VerdictMarket {
  ballots: number
  tallies: Record<string, number>
  winners: string[]
  names: string[]
  outcome: VerdictOutcome
  pot: number
  prophets: number
  hits: number
  paid: number
  refunded: boolean
}

export interface VerdictSummary {
  mvp: VerdictMarket
  inter: VerdictMarket
  mvp_bonus: number
  mvp_bonus_paid: string[]
}

export interface TribunalInfo {
  status: "open" | "settled"
  openedAt: string
  closesAt: string
  settledAt: string | null
  winnerSide: Side | null
  mvpPlayerIds: string[]
  interPlayerIds: string[]
  summary: VerdictSummary | null
}

export interface Candidate {
  playerId: string
  name: string
  side: Side
  lane: Role
  champion: string
  championInternal: string
}

export interface Viewer {
  userId: string
  playerId: string | null
}

export interface ProphecyBoard {
  enabled: boolean
  now: string
  sessionStatus: SessionStatus | null
  open: boolean
  closesAt: string | null
  candidates: Candidate[]
  books: MarketBooks
  wagers: WagerView[]
  mine: WagerView | null
  legacy: LegacyProphecyView[]
  viewer: Viewer | null
  tribunal: TribunalInfo | null
}

export interface VoterView {
  userId: string
  name: string
  avatarUrl: string | null
}

export interface TribunalState {
  enabled: boolean
  now: string
  sessionId: string
  sessionStatus: SessionStatus | null
  vote: TribunalInfo | null
  candidates: Candidate[]
  tallies: Record<Category, Record<string, number>>
  voters: Record<Category, Record<string, VoterView[]>>
  ballots: Record<Category, number>
  mine: Record<Category, string | null>
  viewer: Viewer | null
  pots: Record<Category, number>
  myWager: WagerView | null
}

export interface OpenTribunal {
  sessionId: string
  status: "open" | "settled"
  closesAt: string
  settledAt: string | null
  mvpNames: string[]
  interNames: string[]
}

export interface OpenTribunalResponse {
  enabled: boolean
  now: string
  tribunal: OpenTribunal | null
}

export interface SettledVote extends VerdictSummary {
  session_id: string
}
