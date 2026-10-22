import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive } from "@/lib/live/server"
import { NO_STORE, duelError, duelErrorFromDb, readJson } from "@/lib/duels/server/respond"
import { actorOf, loadDuelists, normalizeDuel, toDuelView, type DuelRow } from "@/lib/duels/server/rows"
import type { LiveActor } from "@/lib/live/events"
import type { DuelAction, DuelView } from "@/lib/duels/types"

type Params = { params: Promise<{ id: string }> }

const idSchema = z.guid()
const actionSchema = z.object({ action: z.enum(["accept", "decline", "withdraw"]) })

const RPC: Record<DuelAction, string> = {
  accept: "accept_duel",
  decline: "decline_duel",
  withdraw: "withdraw_duel",
}

function announce(action: DuelAction, row: DuelRow, view: DuelView, actor: LiveActor | null) {
  const base = { sessionId: row.session_id, actor }
  if (action === "accept") {
    emitLive("duel.accepted", {
      ...base,
      data: {
        challengerName: view.challenger.name,
        opponentName: view.opponent?.name ?? actor?.name ?? "Someone",
        amount: row.stake,
        challengerUserId: row.challenger_id,
        duelId: row.id,
        side: row.challenger_side,
        opponentUserId: row.opponent_id,
      },
    })
  } else if (action === "decline") {
    emitLive("duel.declined", {
      ...base,
      data: {
        challengerName: view.challenger.name,
        opponentName: view.opponent?.name ?? actor?.name ?? "Someone",
        challengerUserId: row.challenger_id,
        duelId: row.id,
        amount: row.stake,
        opponentUserId: row.opponent_id,
      },
    })
  } else {
    emitLive("duel.withdrawn", {
      ...base,
      data: {
        challengerName: view.challenger.name,
        opponentName: view.opponent?.name ?? null,
        amount: row.stake,
        duelId: row.id,
        opponentUserId: row.opponent_id,
      },
    })
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) return duelError("not_found")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return duelError("not_authenticated")

  const parsed = actionSchema.safeParse(await readJson(request))
  if (!parsed.success) return duelError("invalid_request", "Accept, decline or withdraw: pick one.")
  const action = parsed.data.action

  const { data, error } = await supabase.rpc(RPC[action], { p_duel_id: id })
  if (error) return duelErrorFromDb(error)

  const result = (data ?? {}) as { duel?: unknown; balance?: unknown }
  const row = normalizeDuel(result.duel)
  if (!row) return NextResponse.json({ error: "The challenge slipped through the cracks. Refresh." }, { status: 500 })

  const view = toDuelView(row, await loadDuelists(supabase, [row.challenger_id, row.opponent_id]))
  const me = view.challenger.userId === user.id ? view.challenger : view.opponent
  announce(action, row, view, me ? actorOf(me) : null)

  return NextResponse.json(
    { duel: view, balance: typeof result.balance === "number" ? result.balance : null },
    { headers: NO_STORE }
  )
}
