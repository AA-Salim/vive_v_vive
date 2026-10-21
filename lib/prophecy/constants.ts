import type { SessionStatus } from "@/lib/types"

export const CATEGORIES = ["mvp", "inter"] as const
export type Category = (typeof CATEGORIES)[number]

export const STAKE_MIN = 10
export const STAKE_MAX = 50
export const STAKE_CHIPS = [10, 25, 50] as const
export const DEFAULT_STAKE = 25

export const VOTE_WINDOW_MS = 5 * 60 * 1000
export const MVP_BONUS = 15
export const MIN_VOTES_FOR_VERDICT = 2
export const DEBT_FLOOR = -300

export const SEALING_STATUSES: SessionStatus[] = ["chaos", "betting"]
export const RESOLVED_STATUSES: SessionStatus[] = ["blue_win", "red_win"]

export const PROPHECY_FEATURE = "Prophecies"
export const TRIBUNAL_FEATURE = "The post-game vote"
