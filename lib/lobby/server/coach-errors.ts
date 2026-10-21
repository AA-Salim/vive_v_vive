export type CoachDraftErrorCode =
  | "not_authenticated"
  | "session_not_found"
  | "not_drafting"
  | "draft_full"
  | "not_your_turn"
  | "player_unavailable"
  | "not_in_pool"
  | "already_picked"
  | "nothing_to_undo"
  | "not_your_pick"
  | "not_a_coach"
  | "picks_missing"
  | "lanes_missing"
  | "lane_clash"
  | "stale"
  | "undo_unavailable"

export const COACH_DRAFT_ERRORS: Record<CoachDraftErrorCode, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: "Sign in with Discord first." },
  session_not_found: { status: 404, message: "This draft no longer exists." },
  not_drafting: { status: 409, message: "The draft is already over." },
  draft_full: { status: 409, message: "All ten players are drafted." },
  not_your_turn: { status: 403, message: "Not your pick. The other coach is on the clock." },
  player_unavailable: { status: 409, message: "That player is benched or gone. Pick someone else." },
  not_in_pool: { status: 409, message: "That player is not in this draft's pool." },
  already_picked: { status: 409, message: "Already drafted. The notebook does not allow doubles." },
  nothing_to_undo: { status: 409, message: "Nothing to take back." },
  not_your_pick: { status: 403, message: "Only the coach who made the last pick can take it back, before the next pick lands." },
  not_a_coach: { status: 403, message: "Only the two coaches can do that." },
  picks_missing: { status: 409, message: "Ten players must be drafted first." },
  lanes_missing: { status: 409, message: "Every player needs a lane before the teams are locked." },
  lane_clash: { status: 409, message: "Two players share a lane. Each team needs top, jungle, mid, ADC and support." },
  stale: { status: 409, message: "The draft just changed. Check the board and try again." },
  undo_unavailable: { status: 503, message: "Taking back picks arrives with the next database update." },
}

const PATTERN = /coachdraft:([a-z_]+)/

export function coachDraftCode(message: string | null | undefined): CoachDraftErrorCode | null {
  const match = message ? PATTERN.exec(message) : null
  return match && match[1] in COACH_DRAFT_ERRORS ? (match[1] as CoachDraftErrorCode) : null
}
