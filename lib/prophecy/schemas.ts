import { z } from "zod"
import { CATEGORIES, STAKE_MAX, STAKE_MIN } from "@/lib/prophecy/constants"

export const sessionIdSchema = z.guid()

export const sealProphecySchema = z.object({
  market: z.enum(CATEGORIES),
  playerId: z.guid(),
  stake: z.int().min(STAKE_MIN).max(STAKE_MAX),
})

export const castVoteSchema = z.object({
  category: z.enum(CATEGORIES),
  playerId: z.guid(),
})

export function isLegacyProphecyBody(body: unknown): boolean {
  return !!body && typeof body === "object" && "prediction_type" in body
}
