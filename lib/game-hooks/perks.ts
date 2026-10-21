import type { GameHook } from "@/lib/game-hooks/types"
import { settleTitlePerks } from "@/lib/titles/settle"

export const perksHook: GameHook = {
  name: "perks",
  async onResolved(ctx) {
    await settleTitlePerks(ctx)
  },
}
