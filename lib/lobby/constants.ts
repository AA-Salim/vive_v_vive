import type { Role, Side } from "@/lib/types"

export const TEAM_SIZE = 5
export const LOBBY_SIZE = 10

export const SERPENTINE: readonly Side[] = ["blue", "red", "red", "blue", "blue", "red", "red", "blue", "blue", "red"]

export const LANES: readonly Role[] = ["top", "jungle", "mid", "adc", "support"]

// A queue spot belongs to one evening: older entries are ignored by the queue and the rotation.
export const QUEUE_TTL_MS = 12 * 60 * 60_000

export const RECENT_WINDOW_DAYS = 30
export const HISTORY_GAMES = 90
export const FORM_LENGTH = 5

export const PLAYER_NAME_MAX = 24

// The coach dialog hands its player pool to POST /api/sessions/coach-draft through this short-lived cookie,
// so the pool works even when the caller only forwards the two coach ids.
export const COACH_POOL_COOKIE = "vvv_coach_pool"
export const COACH_POOL_PATH = "/api/sessions/coach-draft"

export function sideForPick(pickNumber: number): Side | null {
  return SERPENTINE[pickNumber - 1] ?? null
}

export function queueCutoff(now = Date.now()): string {
  return new Date(now - QUEUE_TTL_MS).toISOString()
}
