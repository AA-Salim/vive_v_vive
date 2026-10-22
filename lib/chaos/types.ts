import type { Role, Side } from "@/lib/types"
import type { DecreeType } from "@/lib/chaos/catalog"
import type { EffectNote } from "@/lib/titles/effects"

export type ChaosSchema = "v2" | "legacy"

export type DecreeStatus = "pending" | "won" | "lost" | "resolved" | "refunded"

export interface DecreeSeat {
  lane: Role
  champion: string
  champion_internal: string
}

export interface DecreeChange {
  assignment_id: string
  player_id: string
  player_name: string | null
  side: Side
  before: DecreeSeat
  after: DecreeSeat
}

export interface DecreeDetails {
  changes?: DecreeChange[]
  target?: DecreeChange
  side?: Side
  banned_champion?: string
  // Written by the title effects (phase10_title-effects.sql): Baron Caller's starting multiplier and the notes of
  // every title that changed this decree. Parse the notes with parseNotes() from lib/titles/effects.ts.
  base_multiplier?: number
  title_effects?: unknown
}

export interface ChaosDecreeEntry {
  id: string
  session_id: string
  user_id: string
  action_type: DecreeType
  tier: string
  cost: number
  side: Side | null
  target_player_id: string | null
  target_player_2_id: string | null
  target_team: Side | null
  payout: number | null
  status: DecreeStatus
  created_at: string
  banned_champion: string | null
  forced_lane: Role | null
  discord_username: string
  discord_avatar_url: string | null
  target_player_name: string | null
  target_player_2_name: string | null
  actor_name: string
  actor_player_id: string | null
  rules_version: number
  affected_side: Side | null
  changed_assignment_ids: string[]
  details: DecreeDetails
  multiplier: number | null
  potential_payout: number | null
}

export interface DecreeRule {
  cost: number
  maxUses: number
  limitGroup: string
  enabled: boolean
}

export type DecreeRuleBook = Record<DecreeType, DecreeRule>

export interface ChaosViewer {
  userId: string
  playerId: string | null
  balance: number | null
}

export interface ChaosBoard {
  sessionId: string
  schema: ChaosSchema
  rules: DecreeRuleBook
  actions: ChaosDecreeEntry[]
  viewer: ChaosViewer | null
}

export interface DecreeResponse {
  success: true
  decree: ChaosDecreeEntry
  balance: number | null
  headline: string
  changedAssignmentIds: string[]
  changedPlayerIds: string[]
  // The titles that changed this decree (also stored in decree.details.title_effects).
  titleEffects?: EffectNote[]
}

export interface BoardAssignment {
  id: string
  player_id: string
  name: string
  side: Side
  lane: Role
  champion: string
  champion_internal: string
}
