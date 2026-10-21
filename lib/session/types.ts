import { z } from "zod"
import type { LiveActor } from "@/lib/live/events"
import type { SessionWithAssignments } from "@/lib/types"

export interface RoomSession extends SessionWithAssignments {
  recent_result?: boolean
  creator?: LiveActor | null
  resolver?: LiveActor | null
}

export type RoomAssignment = SessionWithAssignments["session_assignments"][number]

export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reroll") }),
  z.object({ action: z.literal("toggle_lock"), assignment_id: z.guid() }),
  z.object({ action: z.literal("start_game") }),
  z.object({ action: z.literal("close_chaos") }),
  z.object({ action: z.literal("close_betting") }),
  z.object({ action: z.literal("declare_winner"), winner_side: z.enum(["blue", "red"]) }),
  z.object({ action: z.literal("cancel") }),
])

export type SessionAction = z.infer<typeof sessionActionSchema>
export type SessionActionName = SessionAction["action"]

export const createSessionSchema = z.object({
  player_ids: z
    .array(z.guid())
    .length(10, "Pick exactly 10 players")
    .refine((ids) => new Set(ids).size === 10, "Each player can only be picked once"),
})

export interface ApiErrorBody {
  error: string
  code?: string
}
