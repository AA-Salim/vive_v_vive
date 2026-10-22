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
  | "champions_closed"
  | "champions_unavailable"
  | "champions_locked"
  | "teams_locked"
  | "not_your_player"
  | "player_has_champion"
  | "unknown_champion"
  | "fearless_banned"
  | "champion_taken"
  | "turn_expired"
  | "auto_pick_final"
  | "not_in_draft"
  | "no_champions"
  | "coach_pick_locked"

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
  champions_closed: { status: 409, message: "Champion select opens once both teams are locked." },
  champions_unavailable: { status: 503, message: "Coach champion picks arrive with the next database update." },
  champions_locked: { status: 403, message: "Champion select runs on the server clock. Pick through the board." },
  teams_locked: { status: 409, message: "The teams are locked. Champion select is under way." },
  not_your_player: { status: 403, message: "Pick for one of your own players." },
  player_has_champion: { status: 409, message: "That player already has a champion." },
  unknown_champion: { status: 404, message: "No champion by that name on the Rift." },
  fearless_banned: { status: 409, message: "Fearless: that champion was already played today." },
  champion_taken: { status: 409, message: "Already picked in this game. One of each, like real draft." },
  turn_expired: { status: 409, message: "Time ran out. The server locked a champion for that pick." },
  auto_pick_final: { status: 409, message: "The clock picked that one. Auto-picks are final." },
  not_in_draft: { status: 403, message: "Only players drafted into this game can pin a request." },
  no_champions: { status: 409, message: "No champion is left to pick." },
  coach_pick_locked: { status: 409, message: "Your coach picked this champion. It stays." },
}

const PATTERN = /coachdraft:([a-z_]+)/

export function coachDraftCode(message: string | null | undefined): CoachDraftErrorCode | null {
  const match = message ? PATTERN.exec(message) : null
  return match && match[1] in COACH_DRAFT_ERRORS ? (match[1] as CoachDraftErrorCode) : null
}
