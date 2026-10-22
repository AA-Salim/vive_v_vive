import type { SessionStatus, Side } from "@/lib/types"

// won/lost are the challenger's result; winnerId always names the victor.
export type DuelStatus = "open" | "accepted" | "won" | "lost" | "declined" | "withdrawn" | "expired" | "refunded"

export interface Duelist {
  userId: string
  name: string
  avatarUrl: string | null
  playerId: string | null
}

export interface DuelView {
  id: string
  sessionId: string
  status: DuelStatus
  isOpen: boolean
  stake: number
  challengerSide: Side
  challenger: Duelist
  opponent: Duelist | null
  winnerId: string | null
  winnerSide: Side | null
  payout: number | null
  tax: number
  createdAt: string
  respondedAt: string | null
  settledAt: string | null
}

export interface DuelSessionInfo {
  id: string
  status: SessionStatus
  bettingEndsAt: string | null
  accepting: boolean
  winner: Side | null
}

export interface DuelViewer {
  userId: string
  side: Side | null
}

export interface DuelBoard {
  enabled: boolean
  now: string
  session: DuelSessionInfo
  viewer: DuelViewer | null
  duels: DuelView[]
}

export interface RosterEntry extends Duelist {
  playerIds: string[]
  hasPurse: boolean
}

export interface DuelRoster {
  duelists: RosterEntry[]
}

export interface DuelMutationResult {
  duel: DuelView
  balance: number | null
}

export type DuelAction = "accept" | "decline" | "withdraw"

export interface CreateDuelInput {
  side: Side
  stake: number
  opponentId: string | null
}
