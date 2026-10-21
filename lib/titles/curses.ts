import { CURSE_GAMES, dignityCost } from "@/lib/titles/rules"
import type { CurseState } from "@/lib/titles/types"

export interface ResolvedGame {
  id: string
  startedAt: number
}

// A brand counts down one resolved game at a time, starting with games created after it was applied.
export function curseState(
  bestowedAt: string,
  resolved: ResolvedGame[],
  price: number,
  excludeSessionId?: string
): CurseState {
  const since = Date.parse(bestowedAt)
  const served = resolved.filter((g) => g.startedAt > since && g.id !== excludeSessionId).length
  const left = Math.max(0, CURSE_GAMES - served)
  return { active: left > 0, served: Math.min(served, CURSE_GAMES), left, total: CURSE_GAMES, dignity_cost: dignityCost(price) }
}
