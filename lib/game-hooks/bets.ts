import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { betErrorCode } from "@/lib/betting/errors"
import { announceResolution } from "@/lib/betting/server/resolution"
import type { GameHook } from "@/lib/game-hooks/types"

type RpcError = { message?: string; code?: string } | null
type RpcResult = { data: unknown; error: RpcError }

const V2_ATTEMPTS = 3

async function pendingCount(supabase: SupabaseClient, sessionId: string, scheme?: "v2"): Promise<number | null> {
  let query = supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "pending")
  if (scheme) query = query.eq("scheme", scheme)
  const { count, error } = await query
  return error ? null : count ?? 0
}

function settledCount(data: unknown, field: "settled" | "refunded"): number | null {
  const value = data && typeof data === "object" ? (data as Record<string, unknown>)[field] : null
  return typeof value === "number" ? value : null
}

// Returns how many bets this call settled (null when unknown), so a retried declaration does not announce twice.
// v2 settles new and legacy rows alike; without the migration the legacy function runs. A rule violation
// (bet:not_authorized, bet:invalid_state...) is never bypassed. A transient failure is retried, and only falls
// back to the legacy function when no v2 row is pending: legacy terms would misprice v2 premiums and boosts.
async function settle(
  supabase: SupabaseClient,
  sessionId: string,
  field: "settled" | "refunded",
  v2: () => PromiseLike<RpcResult>,
  legacy: () => PromiseLike<RpcResult>
): Promise<number | null> {
  const runLegacy = async () => {
    const pending = await pendingCount(supabase, sessionId)
    const { error } = await legacy()
    if (error) throw new Error(error.message ?? "Bet settlement failed")
    return pending
  }

  let lastError: RpcError = null
  for (let attempt = 0; attempt < V2_ATTEMPTS; attempt++) {
    const { data, error } = await v2()
    if (!error) return settledCount(data, field)
    if (isMissingSchema(error)) return runLegacy()
    if (betErrorCode(error.message)) throw new Error(error.message ?? "Bet settlement refused")
    lastError = error
  }
  if ((await pendingCount(supabase, sessionId, "v2")) !== 0) {
    throw new Error(lastError?.message ?? "Bet settlement failed")
  }
  return runLegacy()
}

export const betsHook: GameHook = {
  name: "bets",
  async onResolved({ supabase, sessionId, winnerSide }) {
    const settled = await settle(
      supabase,
      sessionId,
      "settled",
      () => supabase.rpc("resolve_bets_v2", { p_session_id: sessionId, p_winner_side: winnerSide }),
      () => supabase.rpc("resolve_bets", { p_session_id: sessionId, p_winner_side: winnerSide })
    )
    if (settled === 0) return
    try {
      await announceResolution(supabase, sessionId, winnerSide)
    } catch {
      // The payout already landed; clients still refresh on the session status event.
    }
  },
  async onCanceled({ supabase, sessionId }) {
    await settle(
      supabase,
      sessionId,
      "refunded",
      () => supabase.rpc("refund_all_bets_v2", { p_session_id: sessionId }),
      () => supabase.rpc("refund_all_bets", { p_session_id: sessionId })
    )
  },
}
