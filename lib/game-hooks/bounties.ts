import type { GameHook } from "@/lib/game-hooks/types"
import { syncTribunal } from "@/lib/bounties/server/pillory"
import { settleSessionBounties } from "@/lib/bounties/server/settle"

export const bountiesHook: GameHook = {
  name: "bounties",
  async onResolved({ supabase, sessionId, loserIds }) {
    // The last game's Tribunal verdict is long settled by now: make sure its Inter is on the wall.
    await syncTribunal(supabase)
    await settleSessionBounties(supabase, sessionId, loserIds)
  },
}
