import type { SupabaseClient } from "@supabase/supabase-js"
import { emitLive } from "@/lib/live/server"
import { betNet } from "@/lib/betting/math"
import { bettorFor, loadBettors, loadSessionBets } from "@/lib/betting/server/rows"
import type { BetRow } from "@/lib/betting/types"
import type { Side } from "@/lib/types"

function netOf(bet: BetRow): number {
  return betNet(bet) ?? 0
}

export async function announceResolution(supabase: SupabaseClient, sessionId: string, winner: Side): Promise<void> {
  const { rows } = await loadSessionBets(supabase, sessionId)
  const settled = rows.filter((r) => r.status !== "pending")
  if (settled.length === 0) return

  const bettors = await loadBettors(
    supabase,
    settled.map((r) => r.user_id)
  )
  const won = settled.filter((r) => r.status === "won")
  const lost = settled.filter((r) => r.status === "lost")
  const top = won.reduce<BetRow | null>((best, r) => (!best || netOf(r) > netOf(best) ? r : best), null)
  const worst = lost.reduce<BetRow | null>((low, r) => (!low || netOf(r) < netOf(low) ? r : low), null)

  emitLive("bet.resolved", {
    sessionId,
    actor: null,
    data: {
      winner,
      totalPool: won.concat(lost).reduce((sum, r) => sum + r.amount, 0),
      topWinner: top ? { name: bettorFor(bettors, top.user_id).name, payout: top.payout ?? 0, profit: netOf(top) } : null,
      biggestLoser: worst ? { name: bettorFor(bettors, worst.user_id).name, loss: Math.abs(netOf(worst)) } : null,
      allInLosers: lost.filter((r) => r.all_in).map((r) => bettorFor(bettors, r.user_id).name),
      refunded: won.length === 0 && lost.length === 0,
      bettors: settled.length,
      insurancePaid: lost.filter((r) => r.insured).reduce((sum, r) => sum + (r.payout ?? 0), 0),
    },
  })
}
