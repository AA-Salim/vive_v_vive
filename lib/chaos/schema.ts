import { z } from "zod"

const side = z.enum(["blue", "red"])
const playerId = z.uuid()

export const sessionIdSchema = z.uuid()

export const decreeRequestSchema = z.discriminatedUnion("action_type", [
  z.object({ action_type: z.literal("double_or_nothing"), side }),
  z.object({ action_type: z.literal("royal_pardon"), target_player_id: playerId }),
  z.object({ action_type: z.literal("reroll_self") }),
  z.object({ action_type: z.literal("champion_ban"), target_player_id: playerId }),
  z.object({ action_type: z.literal("swap_teammate"), target_player_id: playerId }),
  z.object({
    action_type: z.literal("lane_force"),
    target_player_id: playerId,
    target_player_2_id: playerId,
  }),
  z.object({ action_type: z.literal("shuffle_lanes"), target_team: side }),
  z.object({ action_type: z.literal("reroll_champs"), target_team: side }),
])

export type DecreeRequest = z.infer<typeof decreeRequestSchema>

export function requestSide(request: DecreeRequest) {
  if ("side" in request) return request.side
  if ("target_team" in request) return request.target_team
  return null
}

export function requestTargets(request: DecreeRequest): [string | null, string | null] {
  const first = "target_player_id" in request ? request.target_player_id : null
  const second = "target_player_2_id" in request ? request.target_player_2_id : null
  return [first, second]
}
