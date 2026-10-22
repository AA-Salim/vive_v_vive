import type { LiveEvent } from "@/lib/live/events"
import type { Narration, NarrationTone } from "@/lib/live/narration"
import { isSalaxe } from "@/lib/lore/salaxe"
import { fill, pick } from "@/lib/lore/seed"
import type { Role, Side } from "@/lib/types"

export interface LineTemplate {
  title: string
  description?: string
}

export type Values = Record<string, string | number>

const numbers = new Intl.NumberFormat("en-US")

export function pts(value: number | null | undefined): string {
  return numbers.format(Math.round(Number.isFinite(value) ? Number(value) : 0))
}

export function sideName(side: Side | null | undefined): string {
  return side === "red" ? "Red" : side === "blue" ? "Blue" : "a side"
}

export const LANE_NAMES: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Bot",
  support: "Support",
}

export function laneName(lane: string | null | undefined): string | null {
  return lookup(LANE_NAMES, lane) ?? null
}

export function plural(count: number, one: string, many: string): string {
  return `${pts(count)} ${count === 1 ? one : many}`
}

export function listNames(names: readonly string[], max = 3): string {
  const unique = [...new Set(names.filter(Boolean))]
  if (unique.length === 0) return ""
  if (unique.length === 1) return unique[0]
  const shown = unique.slice(0, max)
  const rest = unique.length - shown.length
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
}

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
]

export function roman(value: number): string {
  let n = Math.max(0, Math.floor(value))
  if (n === 0 || n > 39) return String(value)
  let out = ""
  for (const [amount, glyph] of ROMAN) {
    while (n >= amount) {
      out += glyph
      n -= amount
    }
  }
  return out
}

// Payload keys come off the network: "constructor" or "toString" must not resolve to Object.prototype members.
export function lookup<T>(table: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

// Player names are stored lowercase; the King keeps his capital letter.
export function display(value: unknown): string | null {
  const name = text(value)
  return name && isSalaxe(name) ? "Salaxe" : name
}

export function actorName(event: LiveEvent, fallback = "Someone"): string {
  return display(event.actor?.name) ?? fallback
}

export function count(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function say(
  event: LiveEvent,
  salt: string,
  templates: readonly LineTemplate[],
  values: Values,
  tone: NarrationTone
): Narration {
  const line = pick(templates, `${event.id}:${salt}`)
  return {
    title: fill(line.title, values),
    description: line.description ? fill(line.description, values) : undefined,
    tone,
  }
}

export function pickText(event: LiveEvent, salt: string, lines: readonly string[], values: Values = {}): string {
  return fill(pick(lines, `${event.id}:${salt}`), values)
}
