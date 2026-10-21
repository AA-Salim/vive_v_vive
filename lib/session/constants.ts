import type { SessionStatus, Side } from "@/lib/types"

export const CHAOS_DURATION_MS = 90_000
export const BETTING_DURATION_MS = 5 * 60_000
export const RESULT_WINDOW_MS = 30 * 60_000
export const STALE_CLAIM_MS = 2 * 60_000
export const STALE_GAME_MS = 4 * 60 * 60_000

export const GAME_WIN_POINTS = 10
export const GAME_PARTICIPATION_POINTS = 2

export const ACTIVE_SESSION_STATUSES: SessionStatus[] = ["coach_draft", "draft", "chaos", "betting", "in_game"]
export const RESULT_STATUSES: SessionStatus[] = ["blue_win", "red_win", "canceled"]

export function isActiveStatus(status: SessionStatus): boolean {
  return ACTIVE_SESSION_STATUSES.includes(status)
}

export function winnerOf(status: SessionStatus): Side | null {
  if (status === "blue_win") return "blue"
  if (status === "red_win") return "red"
  return null
}

export function phaseDurationMs(status: SessionStatus): number | null {
  if (status === "chaos") return CHAOS_DURATION_MS
  if (status === "betting") return BETTING_DURATION_MS
  return null
}

export function phaseEndsAt(session: { status: SessionStatus; chaos_ends_at: string | null; betting_ends_at: string | null }): number | null {
  const value = session.status === "chaos" ? session.chaos_ends_at : session.status === "betting" ? session.betting_ends_at : null
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}
