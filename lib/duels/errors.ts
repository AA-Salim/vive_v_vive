import { DUEL_RULES } from "@/lib/duels/rules"

export type DuelErrorCode =
  | "not_authenticated"
  | "invalid_request"
  | "invalid_side"
  | "invalid_stake"
  | "self"
  | "session_not_found"
  | "closed"
  | "treason"
  | "opponent_treason"
  | "opponent_unavailable"
  | "no_balance"
  | "too_many_pending"
  | "too_many_thrown"
  | "debt_limit"
  | "open_exists"
  | "pair_exists"
  | "not_found"
  | "not_open"
  | "taken"
  | "not_yours"
  | "not_authorized"
  | "invalid_state"
  | "already_resolved"

export const DUEL_ERRORS: Record<DuelErrorCode, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: "Sign in with Discord to duel." },
  invalid_request: { status: 400, message: "Pick a game, a side and a stake." },
  invalid_side: { status: 400, message: "Pick Blue or Red." },
  invalid_stake: {
    status: 400,
    message: `Stakes run from ${DUEL_RULES.minStake} to ${DUEL_RULES.maxStake} points.`,
  },
  self: { status: 400, message: "You cannot duel yourself. Salaxe tried once. He lost." },
  session_not_found: { status: 404, message: "This game no longer exists." },
  closed: { status: 409, message: "The gates are shut. Challenges close with the betting window." },
  treason: { status: 403, message: "Treason. You cannot fight against your own banner." },
  opponent_treason: { status: 409, message: "They play for that side. Nobody fights against their own banner." },
  opponent_unavailable: { status: 409, message: "That rival has no purse yet. They must claim their starting points first." },
  no_balance: { status: 400, message: "You have no purse yet. Claim your starting points first." },
  too_many_pending: {
    status: 409,
    message: `${DUEL_RULES.maxPending} unanswered gauntlets is the limit. Withdraw one or wait for answers.`,
  },
  too_many_thrown: {
    status: 409,
    message: `${DUEL_RULES.maxThrown} gauntlets in one game is plenty. The herald's voice is gone.`,
  },
  debt_limit: { status: 400, message: `Your purse cannot cover this (floor ${DUEL_RULES.debtFloor}). Even Salaxe's notebook has a last page.` },
  open_exists: { status: 409, message: "You already have an open challenge in this game. Withdraw it first." },
  pair_exists: { status: 409, message: "You two already have a duel this game. One blood feud per pair." },
  not_found: { status: 404, message: "That challenge no longer exists." },
  not_open: { status: 409, message: "That challenge has already been answered." },
  taken: { status: 409, message: "Too slow. Someone else already answered that challenge." },
  not_yours: { status: 403, message: "That gauntlet was thrown at someone else." },
  not_authorized: { status: 403, message: "Only the host or an admin can settle duels." },
  invalid_state: { status: 409, message: "Duels cannot be settled right now." },
  already_resolved: { status: 409, message: "This game is already settled." },
}

const CODE_PATTERN = /duel:([a-z_]+)/

export function duelErrorCode(message: string | null | undefined): DuelErrorCode | null {
  if (!message) return null
  const match = CODE_PATTERN.exec(message)
  if (match && match[1] in DUEL_ERRORS) return match[1] as DuelErrorCode
  if (/debt limit|insufficient balance/i.test(message)) return "debt_limit"
  if (/user balance not found/i.test(message)) return "no_balance"
  return null
}
