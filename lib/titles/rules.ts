// Mirrored in supabase/phase10_titles.sql: keep both in sync.
export const PERK_CAP = 60
export const PERK_PENALTY_CAP = 10
// Every post-game perk of one wearer together, per game: a loadout holds several perks.
export const USER_PERK_CAP = 60
export const MIN_STAKE = 25
export const CURSE_GAMES = 8
export const MAX_ACTIVE_CURSES = 2
// Buying back your dignity costs exactly what the brand cost.
export const DIGNITY_MULTIPLIER = 1
export const TITLE_LOCK_WINDOW_MS = 3 * 60 * 60 * 1000

export function dignityCost(price: number): number {
  return Math.ceil(price * DIGNITY_MULTIPLIER)
}
