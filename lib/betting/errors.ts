import { BET_RULES } from "@/lib/betting/rules"

export type BetErrorCode =
  | "not_authenticated"
  | "invalid_side"
  | "invalid_amount"
  | "session_not_found"
  | "betting_closed"
  | "no_balance"
  | "bet_settled"
  | "side_locked"
  | "all_in_locked"
  | "legacy_locked"
  | "all_in_too_small"
  | "all_in_uninsurable"
  | "insurance_too_small"
  | "already_insured"
  | "no_bet"
  | "debt_limit"
  | "not_authorized"
  | "invalid_state"
  | "refresh_required"

export const BET_ERRORS: Record<BetErrorCode, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: "Log in with Discord to bet." },
  invalid_side: { status: 400, message: "Pick Blue or Red." },
  invalid_amount: { status: 400, message: "Enter a whole number of points." },
  session_not_found: { status: 404, message: "This game no longer exists." },
  betting_closed: { status: 400, message: "Betting has closed. The notebook is shut." },
  no_balance: { status: 400, message: "You have no purse yet. Claim your starting points first." },
  bet_settled: { status: 409, message: "This bet is already settled." },
  side_locked: { status: 409, message: "You already picked a side. No switching mid-war." },
  all_in_locked: { status: 409, message: "You are all-in. There is nothing left to raise." },
  legacy_locked: { status: 409, message: "This bet was placed under the old rules and cannot be raised." },
  all_in_too_small: { status: 400, message: `All-in needs at least ${BET_RULES.allInMin} points on the line.` },
  all_in_uninsurable: { status: 400, message: "All-in bets cannot be insured. Die with your boots on." },
  insurance_too_small: { status: 400, message: `The Guardian Angel only covers stakes of ${BET_RULES.insuranceMin} or more.` },
  already_insured: { status: 409, message: "This bet is already insured." },
  no_bet: { status: 404, message: "No bet to insure yet." },
  debt_limit: { status: 400, message: `Debt limit reached (${BET_RULES.debtFloor}). Even Salaxe's notebook has a last page.` },
  not_authorized: { status: 403, message: "Only the game creator or an admin can settle bets." },
  invalid_state: { status: 409, message: "This game cannot be settled right now." },
  refresh_required: { status: 409, message: "The betting rules changed. Refresh the page to keep betting." },
}

const CODE_PATTERN = /bet:([a-z_]+)/

export function betErrorCode(message: string | null | undefined): BetErrorCode | null {
  if (!message) return null
  const match = CODE_PATTERN.exec(message)
  if (match && match[1] in BET_ERRORS) return match[1] as BetErrorCode
  if (/debt limit/i.test(message)) return "debt_limit"
  if (/insufficient balance/i.test(message)) return "debt_limit"
  if (/user balance not found/i.test(message)) return "no_balance"
  return null
}
