import type { GameHook } from "@/lib/game-hooks/types"

export const chaosHook: GameHook = {
  name: "chaos",
  async onResolved({ supabase, sessionId, winnerSide }) {
    await supabase.rpc("resolve_chaos_wagers", { p_session_id: sessionId, p_winner_side: winnerSide })
  },
  async onCanceled({ supabase, sessionId }) {
    await supabase.rpc("refund_chaos_actions", { p_session_id: sessionId })
  },
}
