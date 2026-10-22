import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { badRequest, rpcError, unauthorized } from "@/lib/bounties/errors"
import { BOUNTY_RULES } from "@/lib/bounties/rules"
import { loadBoard, loadRoster } from "@/lib/bounties/server/board"
import { announceExpired } from "@/lib/bounties/server/settle"
import type { PledgeResult } from "@/lib/bounties/types"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  const supabase = await createClient()
  const view = new URL(request.url).searchParams.get("view")
  try {
    if (view === "roster") {
      return NextResponse.json({ players: await loadRoster(supabase) }, { headers: NO_STORE })
    }
    const { board, expired } = await loadBoard(supabase)
    announceExpired(expired)
    return NextResponse.json(board, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The warrant board fell off the wall." }, { status: 500 })
  }
}

// The pre-warrant client sent { target_player_id, amount }.
const pledgeSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw
    const body = raw as Record<string, unknown>
    return { targetPlayerId: body.targetPlayerId ?? body.target_player_id, amount: body.amount }
  },
  z.object({
    targetPlayerId: z.uuid(),
    amount: z.coerce.number().int().min(1).max(100_000),
  })
)

interface PledgeRpc {
  created: boolean
  pledged: number
  price: number
  mine: number
  backers: number
  balance: number
  target_name: string
  target_user_id: string | null
  expired: {
    warrant_id: string
    target_player_id: string
    target_name: string | null
    target_user_id: string | null
    refunded: number
    backers: number
    escapes: number
  } | null
}

export async function POST(request: Request) {
  const parsed = pledgeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest("Pick a target and an amount.")
  const { targetPlayerId, amount } = parsed.data
  if (amount < BOUNTY_RULES.minPledge) {
    return badRequest(`Warrants start at ${BOUNTY_RULES.minPledge} points.`, "amount_too_small")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorized("Sign in with Discord to sign a royal warrant.")

  const { data, error } = await supabase.rpc("bounty_pledge", { p_target_player_id: targetPlayerId, p_amount: amount })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("Royal warrants")
    return rpcError(error, "The scribe dropped the warrant. Your points are safe, try again.")
  }

  const rpc = data as PledgeRpc
  const actor = await getActor(supabase, user.id)
  if (rpc.expired) announceExpired([rpc.expired])
  emitLive("bounty.placed", {
    actor,
    data: {
      targetName: rpc.target_name,
      amount: rpc.pledged,
      targetUserId: rpc.target_user_id,
      total: rpc.price,
      backers: rpc.backers,
      opened: rpc.created,
    },
  })

  const result: PledgeResult = {
    created: rpc.created,
    pledged: rpc.pledged,
    price: rpc.price,
    mine: rpc.mine,
    backers: rpc.backers,
    balance: typeof rpc.balance === "number" ? rpc.balance : null,
    targetName: rpc.target_name,
  }
  // `placed` keeps tabs still running the pre-warrant client from reporting a failure on success.
  return NextResponse.json({ ...result, placed: true }, { status: rpc.created ? 201 : 200 })
}
