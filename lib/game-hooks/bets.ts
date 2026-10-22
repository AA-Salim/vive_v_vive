import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { betErrorCode } from "@/lib/betting/errors"
import { announceResolution } from "@/lib/betting/server/resolution"
import type { GameHook } from "@/lib/game-hooks/types"

type RpcError = { message?: string; code?: string } | null
type RpcResult = { data: unknown; error: RpcError }

const V2_ATTEMPTS = 3

async function pendingCount(supabase: SupabaseClient, sessionId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "pending")
  return error ? null : count ?? 0
}

function settledCount(data: unknown, field: "settled" | "refunded"): number | null {
  const value = data && typeof data === "object" ? (data as Record<string, unknown>)[field] : null
  return typeof value === "number" ? value : null
}

// Returns how many bets this call settled (null when unknown), so a retried declaration does not announce twice.
// v2 settles new and legacy rows alike; only without the migration does the legacy function run (it is revoked
// from clients by phase11_lockdown.sql). A rule violation (bet:not_authorized, bet:invalid_state...) is never
// bypassed, and a transient failure is retried, then reported.
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
  throw new Error(lastError?.message ?? "Bet settlement failed")
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
