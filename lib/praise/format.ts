const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelative(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime())
  if (elapsed < MINUTE) return "just now"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  return `${seconds}s`
}

// "0:14", "1:30": a riddle clock or solve time.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export const formatMisses = (misses: number) => `${misses} ${misses === 1 ? "miss" : "misses"}`

// "0:14 · 1 miss" (or "· first try"), null when no riddle opened the praise.
export function riddleStat(ms: number | null | undefined, misses: number | null | undefined): string | null {
  if (ms == null) return null
  const missed = misses ?? 0
  return `${formatClock(Math.floor(ms / 1000) * 1000)} · ${missed === 0 ? "first try" : formatMisses(missed)}`
}

// "Solved in 0:14 · 1 miss", for the success screen.
export function formatSolve(ms: number | null | undefined, misses: number | null | undefined): string | null {
  const stat = riddleStat(ms, misses)
  return stat ? `Solved in ${stat}` : null
}

export function formatPoints(value: number): string {
  return value.toLocaleString("en-US")
}

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?"
}
