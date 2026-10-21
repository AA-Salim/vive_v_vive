import type { GameHook } from "@/lib/game-hooks/types"
import {
  markLegacyProphecies,
  openTribunal,
  refundSessionProphecies,
  settleDueVotes,
} from "@/lib/prophecy/server"

// Prophecies settle through the post-game vote, never at declare time. Every helper swallows its own errors
// (including a missing migration) so declaring a winner or canceling can never fail because of side bets.
export const sideBetsHook: GameHook = {
  name: "side-bets",
  async onResolved({ supabase, sessionId, gameId, assignments }) {
    await markLegacyProphecies(supabase, sessionId, assignments)
    await openTribunal(supabase, sessionId, gameId)
    await settleDueVotes(supabase, null)
  },
  async onCanceled({ supabase, sessionId }) {
    await refundSessionProphecies(supabase, sessionId)
    await settleDueVotes(supabase, null)
  },
}
