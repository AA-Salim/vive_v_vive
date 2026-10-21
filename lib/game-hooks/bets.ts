import { isMissingSchema } from "@/lib/db-errors"
import { announceResolution } from "@/lib/betting/server/resolution"
import type { GameHook } from "@/lib/game-hooks/types"

type RpcResult = { error: { message?: string; code?: string } | null }

// v2 settles new and legacy bets alike. A missing migration goes straight to the legacy function;
// any other failure is retried once, then the legacy function runs so stakes never stay locked.
async function settle(v2: () => PromiseLike<RpcResult>, legacy: () => PromiseLike<RpcResult>): Promise<void> {
  let result = await v2()
  if (result.error && !isMissingSchema(result.error)) result = await v2()
  if (!result.error) return
  const fallback = await legacy()
  if (fallback.error) throw new Error(fallback.error.message ?? "Bet settlement failed")
}

export const betsHook: GameHook = {
  name: "bets",
  async onResolved({ supabase, sessionId, winnerSide }) {
    await settle(
      () => supabase.rpc("resolve_bets_v2", { p_session_id: sessionId, p_winner_side: winnerSide }),
      () => supabase.rpc("resolve_bets", { p_session_id: sessionId, p_winner_side: winnerSide })
    )
    try {
      await announceResolution(supabase, sessionId, winnerSide)
    } catch {
      // The payout already landed; clients still refresh on the session status event.
    }
  },
  async onCanceled({ supabase, sessionId }) {
    await settle(
      () => supabase.rpc("refund_all_bets_v2", { p_session_id: sessionId }),
      () => supabase.rpc("refund_all_bets", { p_session_id: sessionId })
    )
  },
}
