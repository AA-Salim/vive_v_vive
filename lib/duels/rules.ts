import type { SessionStatus, Side } from "@/lib/types"

// Mirrors duel_rules() in supabase/phase10_duels.sql: the database enforces every limit, this copy drives the UI.
export const DUEL_RULES = {
  minStake: 10,
  maxStake: 500,
  taxPct: 10,
  maxPending: 3,
  maxThrown: 10,
  debtFloor: -300,
  stakeChips: [10, 25, 50, 100, 250, 500],
} as const

export const DUEL_FEATURE = "Duels"

const ACCEPTING_STATUSES: readonly SessionStatus[] = ["draft", "chaos", "betting"]

export const SIDE_NAME: Record<Side, string> = { blue: "Blue", red: "Red" }

export function otherSide(side: Side): Side {
  return side === "blue" ? "red" : "blue"
}

export function duelTax(stake: number): number {
  return Math.floor((stake * DUEL_RULES.taxPct) / 100)
}

export function duelPayout(stake: number): number {
  return stake * 2 - duelTax(stake)
}

export function duelProfit(stake: number): number {
  return stake - duelTax(stake)
}

export function isValidStake(stake: number): boolean {
  return Number.isInteger(stake) && stake >= DUEL_RULES.minStake && stake <= DUEL_RULES.maxStake
}

export function canAfford(balance: number, stake: number): boolean {
  return balance - stake >= DUEL_RULES.debtFloor
}

export function isAccepting(status: SessionStatus, bettingEndsAt: string | null, serverNow: number): boolean {
  if (!ACCEPTING_STATUSES.includes(status)) return false
  if (status !== "betting" || !bettingEndsAt) return true
  const endsAt = Date.parse(bettingEndsAt)
  return Number.isNaN(endsAt) || endsAt > serverNow
}

export function winnerOfStatus(status: SessionStatus): Side | null {
  if (status === "blue_win") return "blue"
  if (status === "red_win") return "red"
  return null
}
