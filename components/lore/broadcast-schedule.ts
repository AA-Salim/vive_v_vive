import { hashSeed } from "@/lib/lore/seed"

const LAST_KEY = "vvv-broadcast-at"
const SEEN_KEY = "vvv-broadcast-seen"
const MUTE_KEY = "vvv-broadcast-muted-until"
const SEEN_LIMIT = 16

export const FIRST_DELAY_MS: [number, number] = [4 * 60_000, 9 * 60_000]
export const GAP_MS: [number, number] = [28 * 60_000, 45 * 60_000]
export const RETRY_MS = 60_000
export const SHOW_MS = 11_000

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function between([min, max]: [number, number]): number {
  return min + Math.random() * (max - min)
}

// Shared across tabs: a second tab never broadcasts right after the first one did.
export function cooldownLeft(now: number): number {
  const last = Number(read(LAST_KEY)) || 0
  return Math.max(0, last + GAP_MS[0] - now)
}

export function nextDelay(now: number): number {
  return Math.max(between(FIRST_DELAY_MS), cooldownLeft(now))
}

export function markShown(now: number, line: string): void {
  write(LAST_KEY, String(now))
  const id = String(hashSeed(line))
  write(SEEN_KEY, JSON.stringify([id, ...seenIds().filter((s) => s !== id)].slice(0, SEEN_LIMIT)))
}

export function seenIds(): string[] {
  try {
    const value = JSON.parse(read(SEEN_KEY) ?? "[]") as unknown
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

export function freshLines<T>(lines: readonly T[], text: (line: T) => string): T[] {
  const seen = new Set(seenIds())
  const fresh = lines.filter((line) => !seen.has(String(hashSeed(text(line)))))
  return fresh.length > 0 ? fresh : [...lines]
}

export function isMuted(now: number): boolean {
  return (Number(read(MUTE_KEY)) || 0) > now
}

export function muteUntilTomorrow(now: number): void {
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  write(MUTE_KEY, String(tomorrow.getTime()))
}
