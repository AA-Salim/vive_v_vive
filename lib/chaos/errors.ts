export const CHAOS_ERRORS = {
  not_authenticated: { status: 401, message: "Log in with Discord to issue decrees." },
  session_not_found: { status: 404, message: "That game has vanished from the royal records." },
  window_closed: { status: 409, message: "Too late. The decree window has closed and the court has moved on." },
  unknown_decree: { status: 400, message: "That decree is not in the royal book." },
  retired_decree: { status: 410, message: "That decree was retired. Exile a Champion does the job now." },
  limit_reached: { status: 409, message: "You already used that decree this game. Even exiled kings have rules." },
  players_only: { status: 403, message: "Only players in this game can issue that decree." },
  invalid_side: { status: 400, message: "Choose Blue or Red." },
  treason: { status: 409, message: "Treason. You cannot wager against your own team." },
  fence_sitter: { status: 409, message: "Pick a side and stay there: all your wagers this game ride on one team." },
  target_not_in_game: { status: 400, message: "That player is not in this game." },
  target_not_teammate: { status: 400, message: "Both seats must belong to the same team." },
  same_target: { status: 400, message: "Pick two different players." },
  self_target: { status: 400, message: "That decree is for other people. Pick someone else." },
  target_pardoned: { status: 409, message: "That player holds a Royal Pardon. Their draft is untouchable." },
  already_pardoned: { status: 409, message: "That player is already pardoned." },
  not_enough_targets: { status: 409, message: "Not enough unpardoned players on that team." },
  no_champion: { status: 409, message: "The champion pool for that lane has run dry." },
  debt_limit: { status: 402, message: "Debt limit reached (-300). The treasury refuses to lend another coin." },
  no_purse: { status: 409, message: "You do not have a royal purse yet. Claim your starting points first." },
  busy: { status: 503, message: "The court is swamped. Try that decree again." },
  forbidden: { status: 403, message: "Only the game's creator or an admin can do that." },
  failed: { status: 500, message: "The decree failed. No points were taken." },
} as const

export type ChaosErrorCode = keyof typeof CHAOS_ERRORS

export function isChaosErrorCode(code: string): code is ChaosErrorCode {
  return code in CHAOS_ERRORS
}

export function parseChaosError(error: { message?: string; code?: string } | null | undefined): ChaosErrorCode {
  if (!error) return "failed"
  const message = error.message ?? ""
  const tagged = /chaos:([a-z_]+)/.exec(message)?.[1]
  if (tagged && isChaosErrorCode(tagged)) return tagged
  if (/min_balance|debt limit|insufficient balance/i.test(message)) return "debt_limit"
  if (/user balance not found/i.test(message)) return "no_purse"
  if (error.code === "40P01" || error.code === "55P03" || error.code === "57014") return "busy"
  return "failed"
}

export class ChaosDecreeError extends Error {
  constructor(readonly code: ChaosErrorCode) {
    super(CHAOS_ERRORS[code].message)
  }
}
