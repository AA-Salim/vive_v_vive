import { z } from "zod"
import { PLAYER_NAME_MAX } from "@/lib/lobby/constants"
import type { Role, Side } from "@/lib/types"

export type GameResult = "W" | "L"

export interface RosterPlayer {
  id: string
  name: string
  is_active: boolean
  is_admin: boolean
  wins: number
  losses: number
  games_played: number
  created_at: string
  auth_user_id: string | null
  recent_games: number
  last_played_at: string | null
  form: GameResult[]
}

export interface QueueEntryView {
  id: string
  player_id: string
  position: number
  joined_at: string
  name: string
  user_id: string | null
}

export interface PlayerRef {
  id: string
  name: string
  userId: string | null
}

export interface VainqueurView {
  active: boolean
  lastSessionId: string | null
  lastWinner: Side | null
  hostUserId: string | null
  winners: PlayerRef[]
  satOut: PlayerRef[]
  losers: PlayerRef[]
  volunteers: string[]
  updatedAt: string | null
}

export interface CoachDraftPickView {
  id: string
  session_id: string
  pick_number: number
  player_id: string
  side: Side
  lane: Role | null
  created_at: string
  players?: { id: string; name: string } | null
}

export interface CoachProfile {
  id: string
  discord_username: string
  discord_avatar_url: string | null
}

export const RotationModeSchema = z.enum(["throne", "shuffle"])
export type RotationMode = z.infer<typeof RotationModeSchema>

const PlayerId = z.guid()

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1, "Give them a name")
  .max(PLAYER_NAME_MAX, `Names stop at ${PLAYER_NAME_MAX} characters`)
  .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), "No control characters")

export const CreatePlayerSchema = z.object({ name: PlayerNameSchema })

export const UpdatePlayerSchema = z
  .object({ name: PlayerNameSchema.optional(), is_active: z.boolean().optional() })
  .strict()
  .refine((patch) => patch.name !== undefined || patch.is_active !== undefined, "Nothing to change")

export const QueueActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("leave"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("move"), player_id: PlayerId, to: z.number().int().min(0).max(200) }),
  z.object({ action: z.literal("clear") }),
])
export type QueueAction = z.infer<typeof QueueActionSchema>

export const VainqueurActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("volunteer"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("unvolunteer"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("sit_out"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("return"), player_id: PlayerId.optional() }),
  z.object({ action: z.literal("next_game"), mode: RotationModeSchema.optional() }),
])
export type VainqueurAction = z.infer<typeof VainqueurActionSchema>

const LaneSchema = z.enum(["top", "jungle", "mid", "adc", "support"])

export const CoachDraftActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pick"), player_id: PlayerId }),
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("assign_lane"), player_id: PlayerId, lane: LaneSchema }),
  z.object({ action: z.literal("auto_lanes") }),
  z.object({ action: z.literal("confirm") }),
])
export type CoachDraftAction = z.infer<typeof CoachDraftActionSchema>

export const StartCoachDraftSchema = z
  .object({
    blue_coach_id: z.guid(),
    red_coach_id: z.guid(),
    player_ids: z.array(PlayerId).min(10).max(40).optional(),
  })
  .refine((body) => body.blue_coach_id !== body.red_coach_id, "Pick two different coaches")
  .refine((body) => !body.player_ids || new Set(body.player_ids).size === body.player_ids.length, "Each player can only be in the pool once")
