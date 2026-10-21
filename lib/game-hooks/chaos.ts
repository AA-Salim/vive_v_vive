import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import type { GameHook } from "@/lib/game-hooks/types"

type RpcError = { code?: string; message?: string } | null

// The v2 functions are race-safe and idempotent; the legacy ones keep games settling until the migration lands.
async function withLegacyFallback(
  run: () => PromiseLike<{ error: RpcError }>,
  legacy: () => PromiseLike<{ error: RpcError }>
) {
  const { error } = await run()
  if (!error) return
  if (!isMissingSchema(error) && error.code !== "42501") throw new Error(error.message ?? "chaos hook failed")
  const fallback = await legacy()
  if (fallback.error) throw new Error(fallback.error.message ?? "chaos hook failed")
}

function rpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>) {
  return () => supabase.rpc(fn, args)
}

export const chaosHook: GameHook = {
  name: "chaos",
  async onResolved({ supabase, sessionId, winnerSide, gameId }) {
    await withLegacyFallback(
      rpc(supabase, "resolve_chaos_wagers_v2", { p_session_id: sessionId, p_winner_side: winnerSide, p_game_id: gameId }),
      rpc(supabase, "resolve_chaos_wagers", { p_session_id: sessionId, p_winner_side: winnerSide })
    )
  },
  async onCanceled({ supabase, sessionId }) {
    await withLegacyFallback(
      rpc(supabase, "refund_chaos_actions_v2", { p_session_id: sessionId }),
      rpc(supabase, "refund_chaos_actions", { p_session_id: sessionId })
    )
  },
}
