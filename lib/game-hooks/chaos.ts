import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import type { GameHook } from "@/lib/game-hooks/types"

type RpcError = { code?: string; message?: string } | null

const isRuleViolation = (error: NonNullable<RpcError>) => /chaos:[a-z_]+/.test(error.message ?? "")

// The v2 functions are race-safe and idempotent, so a transient failure is retried once. Their own refusals
// (chaos:*) are final. The legacy functions (revoked from clients by phase11_lockdown.sql) only stand in while
// the migration is missing.
async function withLegacyFallback(
  run: () => PromiseLike<{ error: RpcError }>,
  legacy: () => PromiseLike<{ error: RpcError }>
) {
  let { error } = await run()
  if (error && !isMissingSchema(error) && !isRuleViolation(error)) ({ error } = await run())
  if (!error) return
  if (!isMissingSchema(error)) throw new Error(error.message ?? "chaos hook failed")
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
