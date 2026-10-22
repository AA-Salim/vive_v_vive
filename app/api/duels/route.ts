import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive } from "@/lib/live/server"
import { DUEL_RULES } from "@/lib/duels/rules"
import { buildDuelBoard } from "@/lib/duels/server/board"
import { NO_STORE, duelError, duelErrorFromDb, readJson } from "@/lib/duels/server/respond"
import { actorOf, loadDuelists, normalizeDuel, toDuelView } from "@/lib/duels/server/rows"
import { announceSweep } from "@/lib/duels/server/settlement"

const querySchema = z.object({ sessionId: z.guid() })

const createSchema = z.object({
  sessionId: z.guid(),
  side: z.enum(["blue", "red"]),
  stake: z.number().int().min(DUEL_RULES.minStake).max(DUEL_RULES.maxStake),
  opponentId: z.guid().nullish(),
})

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({ sessionId: new URL(request.url).searchParams.get("sessionId") })
  if (!parsed.success) return duelError("session_not_found")

  const supabase = await createClient()
  try {
    const result = await buildDuelBoard(supabase, parsed.data.sessionId)
    if (!result) return duelError("session_not_found")
    const announcements = [
      ...(result.sweep ? [announceSweep(supabase, parsed.data.sessionId, result.sweep, result.duelists)] : []),
      ...result.stale.map((stale) => announceSweep(supabase, stale.sessionId, stale.sweep)),
    ]
    await Promise.all(announcements.map((announcement) => announcement.catch(() => undefined)))
    return NextResponse.json(result.board, { headers: { ...NO_STORE, "x-server-time": result.board.now } })
  } catch {
    return NextResponse.json(
      { error: "The court scribe lost the duel ledger. Try again." },
      { status: 500, headers: NO_STORE }
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return duelError("not_authenticated")

  const parsed = createSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    if (field === "side") return duelError("invalid_side")
    if (field === "stake") return duelError("invalid_stake")
    return duelError("invalid_request")
  }
  const { sessionId, side, stake } = parsed.data
  const opponentId = parsed.data.opponentId ?? null
  if (opponentId === user.id) return duelError("self")

  const { data, error } = await supabase.rpc("create_duel", {
    p_session_id: sessionId,
    p_side: side,
    p_stake: stake,
    p_opponent_id: opponentId,
  })
  if (error) return duelErrorFromDb(error)

  const result = (data ?? {}) as { duel?: unknown; balance?: unknown }
  const row = normalizeDuel(result.duel)
  if (!row) return NextResponse.json({ error: "The gauntlet vanished mid-air. Refresh." }, { status: 500 })

  const view = toDuelView(row, await loadDuelists(supabase, [row.challenger_id, row.opponent_id]))
  emitLive("duel.challenged", {
    sessionId,
    actor: actorOf(view.challenger),
    data: {
      challengerName: view.challenger.name,
      opponentName: view.opponent?.name ?? null,
      amount: row.stake,
      side: row.challenger_side,
      opponentUserId: row.opponent_id,
      duelId: row.id,
    },
  })

  return NextResponse.json(
    { duel: view, balance: typeof result.balance === "number" ? result.balance : null },
    { status: 201, headers: NO_STORE }
  )
}
