import { z } from "zod"
import type { Role, SessionStatus, Side } from "@/lib/types"

// League draft order: Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1 (coach_champion_side() in SQL).
export const CHAMPION_PICK_ORDER: readonly Side[] = ["blue", "red", "red", "blue", "blue", "red", "red", "blue", "blue", "red"]

// Mirrors coach_champion_clock() and coach_champion_grace(): deadlines always come from the server.
export const CHAMPION_PICK_SECONDS = 30
export const CHAMPION_PICK_GRACE_MS = 2_000

export const LANE_ORDER: readonly Role[] = ["top", "jungle", "mid", "adc", "support"]

export function sideForChampionPick(pickNumber: number): Side | null {
  return CHAMPION_PICK_ORDER[pickNumber - 1] ?? null
}

// Columns added by supabase/phase10_coach-champions.sql. Absent (not null) while the migration is pending.
export interface ChampionSelectColumns {
  champion_draft_at?: string | null
  champion_turn_ends_at?: string | null
}

export function championSelectSupported(session: object): boolean {
  return Object.prototype.hasOwnProperty.call(session, "champion_draft_at")
}

export function championSelectOpen(session: { status: SessionStatus } & ChampionSelectColumns): boolean {
  return session.status === "coach_draft" && !!session.champion_draft_at
}

export interface CatalogChampion {
  name: string
  internal: string
  roles: Role[]
}

export interface ChampionSlot {
  player_id: string
  name: string
  user_id: string | null
  side: Side
  lane: Role | null
}

export interface ChampionPickView {
  id: string
  pick_number: number
  side: Side
  player_id: string
  lane: Role
  champion: string
  champion_internal: string
  picked_by: string | null
  auto: boolean
  requested: boolean
  created_at: string
}

export interface ChampionRequestView {
  player_id: string
  champion: string
  champion_internal: string
  updated_at: string
}

export interface ChampionTurn {
  pickNumber: number
  side: Side
  coachId: string | null
  endsAt: string | null
}

export interface ChampionDraftView {
  supported: boolean
  status: SessionStatus | null
  open: boolean
  blueCoachId: string | null
  redCoachId: string | null
  turn: ChampionTurn | null
  slots: ChampionSlot[]
  picks: ChampionPickView[]
  requests: ChampionRequestView[]
  serverTime: string
}

const ChampionName = z.string().trim().min(1, "Pick a champion").max(40, "That is not a champion")

export const ChampionDraftActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pick"),
    player_id: z.guid(),
    champion: ChampionName,
    pick_number: z.number().int().min(1).max(10),
  }),
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("request"), champion: ChampionName.nullable() }),
])
export type ChampionDraftAction = z.infer<typeof ChampionDraftActionSchema>

export type ChampionBlock = { reason: "fearless" } | { reason: "taken"; pick: ChampionPickView }

export function championBlock(name: string, picks: readonly ChampionPickView[], fearless: ReadonlySet<string>): ChampionBlock | null {
  const pick = picks.find((p) => p.champion === name)
  if (pick) return { reason: "taken", pick }
  return fearless.has(name) ? { reason: "fearless" } : null
}

// "Kai'Sa", "kaisa" and "Kai Sa" all match.
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}
