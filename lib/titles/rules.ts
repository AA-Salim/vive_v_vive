import { byRules } from "@/lib/titles/rules-version"

// Mirrored in supabase/phase10_titles.sql: keep both in sync. The caps follow the live title rules
// (lib/titles/rules-version.ts): the most one perk moves per game, and every perk of one wearer together per game.
export function perkCap(): number {
  return byRules(60, 90)
}
export function userPerkCap(): number {
  return byRules(60, 100)
}
export const PERK_PENALTY_CAP = 10
export const MIN_STAKE = 25
export const CURSE_GAMES = 8
export const MAX_ACTIVE_CURSES = 2
// Buying back your dignity costs exactly what the brand cost.
export const DIGNITY_MULTIPLIER = 1
export const TITLE_LOCK_WINDOW_MS = 3 * 60 * 60 * 1000

export function dignityCost(price: number): number {
  return Math.ceil(price * DIGNITY_MULTIPLIER)
}
