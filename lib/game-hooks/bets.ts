import type { GameHook } from "@/lib/game-hooks/types"

export const betsHook: GameHook = {
  name: "bets",
  async onResolved({ supabase, sessionId, winnerSide }) {
    await supabase.rpc("resolve_bets", { p_session_id: sessionId, p_winner_side: winnerSide })
  },
  async onCanceled({ supabase, sessionId }) {
    await supabase.rpc("refund_all_bets", { p_session_id: sessionId })
  },
}
