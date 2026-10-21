import { betsHook } from "@/lib/game-hooks/bets"
import { bountiesHook } from "@/lib/game-hooks/bounties"
import { chaosHook } from "@/lib/game-hooks/chaos"
import { perksHook } from "@/lib/game-hooks/perks"
import { sideBetsHook } from "@/lib/game-hooks/side-bets"
import type { GameCanceledContext, GameHook, GameResolvedContext } from "@/lib/game-hooks/types"

// Order matters: perks read the settled results of every earlier hook.
const HOOKS: GameHook[] = [betsHook, chaosHook, bountiesHook, sideBetsHook, perksHook]

export async function runGameResolvedHooks(ctx: GameResolvedContext): Promise<string[]> {
  const failures: string[] = []
  for (const hook of HOOKS) {
    if (!hook.onResolved) continue
    try {
      await hook.onResolved(ctx)
    } catch {
      failures.push(hook.name)
    }
  }
  return failures
}

export async function runGameCanceledHooks(ctx: GameCanceledContext): Promise<string[]> {
  const failures: string[] = []
  for (const hook of HOOKS) {
    if (!hook.onCanceled) continue
    try {
      await hook.onCanceled(ctx)
    } catch {
      failures.push(hook.name)
    }
  }
  return failures
}

export type { GameCanceledContext, GameResolvedContext } from "@/lib/game-hooks/types"
