import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { duelistFor, loadDuelists } from "@/lib/duels/server/rows"
import type { Duelist } from "@/lib/duels/types"
import type { Side } from "@/lib/types"

export interface SettledDuel {
  id: string
  challengerId: string
  opponentId: string
  winnerId: string
  loserId: string
  stake: number
  payout: number
  tax: number
}

export interface DuelSweep {
  action: "none" | "expired" | "settled" | "refunded"
  winnerSide: Side | null
  settled: SettledDuel[]
  expired: number
  expiredTotal: number
  expiredUserIds: string[]
  refunded: number
}

type Raw = Record<string, unknown>
type RpcError = { code?: string; message?: string } | null

const NONE: DuelSweep = {
  action: "none",
  winnerSide: null,
  settled: [],
  expired: 0,
  expiredTotal: 0,
  expiredUserIds: [],
  refunded: 0,
}

const ACTIONS: readonly DuelSweep["action"][] = ["none", "expired", "settled", "refunded"]

const count = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0)
const text = (value: unknown) => (typeof value === "string" ? value : "")

function parseSettled(value: unknown): SettledDuel[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Raw => !!item && typeof item === "object")
    .map((item) => ({
      id: text(item.id),
      challengerId: text(item.challenger_id),
      opponentId: text(item.opponent_id),
      winnerId: text(item.winner_id),
      loserId: text(item.loser_id),
      stake: count(item.stake),
      payout: count(item.payout),
      tax: count(item.tax),
    }))
    .filter((duel) => duel.id && duel.winnerId && duel.loserId)
}

export function parseSweep(raw: unknown): DuelSweep {
  if (!raw || typeof raw !== "object") return NONE
  const r = raw as Raw
  const action = ACTIONS.includes(r.action as DuelSweep["action"]) ? (r.action as DuelSweep["action"]) : "none"
  return {
    action,
    winnerSide: r.winner_side === "blue" || r.winner_side === "red" ? r.winner_side : null,
    settled: parseSettled(r.settled),
    expired: count(r.expired),
    expiredTotal: count(r.expired_total),
    expiredUserIds: Array.isArray(r.expired_user_ids) ? r.expired_user_ids.filter((id): id is string => typeof id === "string") : [],
    refunded: count(r.refunded),
  }
}

export function sweepChanged(sweep: DuelSweep): boolean {
  return sweep.settled.length > 0 || sweep.expired > 0 || sweep.refunded > 0
}

// A missing migration resolves to null; any other failure is retried once (deadlocks, timeouts), then thrown.
async function runRpc(run: () => PromiseLike<{ data: unknown; error: RpcError }>, label: string): Promise<DuelSweep | null> {
  let result = await run()
  if (result.error && isMissingSchema(result.error)) return null
  if (result.error) result = await run()
  if (result.error) {
    if (isMissingSchema(result.error)) return null
    throw new Error(result.error.message ?? `${label} failed`)
  }
  return parseSweep(result.data)
}

export function settleSessionDuels(supabase: SupabaseClient, sessionId: string, winnerSide: Side, gameId: string) {
  return runRpc(
    () => supabase.rpc("settle_duels", { p_session_id: sessionId, p_winner_side: winnerSide, p_game_id: gameId }),
    "Duel settlement"
  )
}

export function refundSessionDuels(supabase: SupabaseClient, sessionId: string) {
  return runRpc(() => supabase.rpc("refund_duels", { p_session_id: sessionId }), "Duel refund")
}

export async function sweepSessionDuels(supabase: SupabaseClient, sessionId: string): Promise<DuelSweep | null> {
  const { data, error } = await supabase.rpc("sweep_duels", { p_session_id: sessionId })
  if (error) return null
  return parseSweep(data)
}

export interface StaleSweep {
  sessionId: string
  sweep: DuelSweep
}

// Finishes settlements and refunds a failed hook left behind on games that are already over.
export async function sweepStaleDuels(supabase: SupabaseClient): Promise<StaleSweep[]> {
  const { data, error } = await supabase.rpc("sweep_stale_duels")
  if (error || !Array.isArray(data)) return []
  return data
    .filter((item): item is Raw => !!item && typeof item === "object")
    .map((item) => ({ sessionId: text(item.session_id), sweep: parseSweep(item) }))
    .filter((stale) => stale.sessionId && sweepChanged(stale.sweep))
}

// Verdicts for every settled duel (personal alerts for both fighters) and one line for unanswered challenges.
// Refunds after a cancel stay quiet: the canceled-game announcement already says every stake went home.
export async function announceSweep(
  supabase: SupabaseClient,
  sessionId: string,
  sweep: DuelSweep,
  known?: Map<string, Duelist>
): Promise<void> {
  if (sweep.settled.length > 0) {
    const fighters = sweep.settled.flatMap((duel) => [duel.winnerId, duel.loserId])
    const names = known && fighters.every((id) => known.has(id)) ? known : await loadDuelists(supabase, fighters)
    for (const duel of sweep.settled) {
      emitLive("duel.resolved", {
        sessionId,
        actor: null,
        data: {
          winnerName: duelistFor(names, duel.winnerId).name,
          loserName: duelistFor(names, duel.loserId).name,
          amount: duel.stake,
          winnerUserId: duel.winnerId,
          loserUserId: duel.loserId,
          duelId: duel.id,
          payout: duel.payout,
          tax: duel.tax,
          ...(sweep.winnerSide ? { winnerSide: sweep.winnerSide } : {}),
        },
      })
    }
  }
  if (sweep.expired > 0 && sweep.action !== "refunded") {
    emitLive("duel.expired", {
      sessionId,
      actor: null,
      data: { count: sweep.expired, amount: sweep.expiredTotal, userIds: sweep.expiredUserIds },
    })
  }
}
