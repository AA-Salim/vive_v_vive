import type { SupabaseClient } from "@supabase/supabase-js"
import { isAccepting, winnerOfStatus } from "@/lib/duels/rules"
import { playerSideOf } from "@/lib/duels/server/accounts"
import {
  loadDuelRows,
  loadDuelSession,
  loadDuelists,
  toDuelView,
  viewerIdOf,
  type DuelRow,
  type DuelSessionRow,
} from "@/lib/duels/server/rows"
import { sweepChanged, sweepSessionDuels, sweepStaleDuels, type DuelSweep, type StaleSweep } from "@/lib/duels/server/settlement"
import type { DuelBoard, DuelSessionInfo, Duelist } from "@/lib/duels/types"

const RESOLVED = ["blue_win", "red_win", "canceled", "expired"]

// Work the lazy sweep would do: unanswered challenges once the gates closed, and duels a hook left behind.
function needsSweep(session: DuelSessionRow, rows: DuelRow[], accepting: boolean): boolean {
  if (accepting) return false
  if (RESOLVED.includes(session.status)) return rows.some((r) => r.status === "open" || r.status === "accepted")
  return rows.some((r) => r.status === "open")
}

function sessionInfo(session: DuelSessionRow, accepting: boolean): DuelSessionInfo {
  return {
    id: session.id,
    status: session.status,
    bettingEndsAt: session.betting_ends_at,
    accepting,
    winner: winnerOfStatus(session.status),
  }
}

export interface BoardResult {
  board: DuelBoard
  sweep: DuelSweep | null
  stale: StaleSweep[]
  duelists: Map<string, Duelist>
}

export async function buildDuelBoard(supabase: SupabaseClient, sessionId: string): Promise<BoardResult | null> {
  const [session, viewerId, loaded] = await Promise.all([
    loadDuelSession(supabase, sessionId),
    viewerIdOf(supabase),
    loadDuelRows(supabase, sessionId),
  ])
  if (!session) return null
  const accepting = isAccepting(session.status, session.betting_ends_at, Date.now())

  let rows = loaded
  if (rows === null) {
    return {
      board: { enabled: false, now: new Date().toISOString(), session: sessionInfo(session, accepting), viewer: null, duels: [] },
      sweep: null,
      stale: [],
      duelists: new Map(),
    }
  }

  let sweep: DuelSweep | null = null
  if (viewerId && needsSweep(session, rows, accepting)) {
    sweep = await sweepSessionDuels(supabase, sessionId)
    if (sweep && sweepChanged(sweep)) rows = (await loadDuelRows(supabase, sessionId)) ?? rows
  }
  // A fresh draft is the first board anyone opens after a canceled game, the one place its stranded stakes surface.
  const [stale, duelists] = await Promise.all([
    viewerId && session.status === "draft" ? sweepStaleDuels(supabase) : Promise.resolve<StaleSweep[]>([]),
    loadDuelists(supabase, [viewerId, ...rows.flatMap((r) => [r.challenger_id, r.opponent_id, r.winner_id])]),
  ])
  const viewerSide = viewerId ? await playerSideOf(supabase, sessionId, duelists.get(viewerId)) : null

  return {
    board: {
      enabled: true,
      now: new Date().toISOString(),
      session: sessionInfo(session, accepting),
      viewer: viewerId ? { userId: viewerId, side: viewerSide } : null,
      duels: rows.map((row) => toDuelView(row, duelists)),
    },
    sweep: sweep && sweepChanged(sweep) ? sweep : null,
    stale,
    duelists,
  }
}
