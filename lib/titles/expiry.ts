// Games left on a bought title, as served by the titles API: a number once titles expire (0 = expired, renew it),
// null for a title that never expires, undefined before the expiring-titles migration.
export type GamesLeft = number | null | undefined

export function isExpired(gamesLeft: GamesLeft): boolean {
  return gamesLeft === 0
}

export function expires(gamesLeft: GamesLeft): gamesLeft is number {
  return typeof gamesLeft === "number"
}

export function gamesLeftLabel(gamesLeft: number): string {
  if (gamesLeft <= 0) return "Expired"
  return `${gamesLeft} game${gamesLeft === 1 ? "" : "s"} left`
}

export function gamesLabel(games: number): string {
  return `${games} game${games === 1 ? "" : "s"}`
}

// Few enough games left to warn about.
export function runningOut(gamesLeft: GamesLeft): boolean {
  return typeof gamesLeft === "number" && gamesLeft > 0 && gamesLeft <= 3
}
