import type { GameHook } from "@/lib/game-hooks/types"
import { announceSweep, refundSessionDuels, settleSessionDuels } from "@/lib/duels/server/settlement"

// Both functions are idempotent and only touch live rows, so a retried declaration settles nothing twice.
// A missing migration resolves to null: no table, nothing to settle.
export const duelsHook: GameHook = {
  name: "duels",
  async onResolved({ supabase, sessionId, winnerSide, gameId }) {
    const sweep = await settleSessionDuels(supabase, sessionId, winnerSide, gameId)
    if (!sweep) return
    try {
      await announceSweep(supabase, sessionId, sweep)
    } catch {
      // The pot already landed; the resolution status event refreshes every board.
    }
  },
  async onCanceled({ supabase, sessionId }) {
    await refundSessionDuels(supabase, sessionId)
  },
}
