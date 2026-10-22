import { roman } from "@/lib/lore/herald/kit"
import type { Season } from "@/lib/pages/types"
import type { ActStatus } from "@/lib/types"

// Shared by the API routes and the season picker, so both sides agree on what an act covers.

export interface ActRow {
  id: number
  act_number: number
  name: string
  subtitle: string | null
  status: ActStatus
  started_at: string
  ended_at: string | null
}

// Games count in [from, to): an act that is still running has no upper bound.
export interface PlayedWindow {
  from: string | null
  to: string | null
}

export const ALL_TIME: PlayedWindow = { from: null, to: null }

export function toSeason(row: ActRow): Season {
  const name = row.subtitle?.trim() || row.name.replace(/^Act\s+[IVXLC\d]+\s*[:\-·]\s*/i, "")
  return { id: row.id, number: row.act_number, name, status: row.status, startedAt: row.started_at, endedAt: row.ended_at }
}

export const seasonTitle = (season: Season | null) => (season ? `Act ${roman(season.number)} · ${season.name}` : "All time")

export const seasonShort = (season: Season | null) => (season ? `Act ${roman(season.number)}` : "All time")

// The act being played, or the latest one that has started when the court sits between acts.
export function currentSeason(seasons: Season[], now = Date.now()): Season | null {
  const active = seasons.find((s) => s.status === "active")
  if (active) return active
  return [...seasons].reverse().find((s) => s.status !== "upcoming" && Date.parse(s.startedAt) <= now) ?? null
}

export const windowOf = (season: Season | null): PlayedWindow =>
  season ? { from: season.startedAt, to: season.status === "active" ? null : season.endedAt } : ALL_TIME

export function inWindow(playedAt: string, window: PlayedWindow): boolean {
  const at = Date.parse(playedAt)
  return (!window.from || at >= Date.parse(window.from)) && (!window.to || at < Date.parse(window.to))
}

export function seasonOfGame(seasons: Season[], playedAt: string): Season | null {
  return seasons.find((s) => s.status !== "upcoming" && inWindow(playedAt, windowOf(s))) ?? null
}
