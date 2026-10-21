import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { BET_RULES } from "@/lib/betting/rules"
import { legacyInsureBet, legacyPlaceBet } from "@/lib/betting/server/legacy"
import { betError, betErrorFromDb } from "@/lib/betting/server/respond"
import { viewerId } from "@/lib/betting/server/rows"
import { buildMarketSnapshot } from "@/lib/betting/server/snapshot"
import type { BetRow, InsureBetResult, PlaceBetResult } from "@/lib/betting/types"
import type { Side } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

const SessionIdSchema = z.uuid()
const RulesSchema = z.union([z.literal(1), z.literal(2)]).optional()

const PlaceSchema = z.object({
  side: z.enum(["blue", "red"]),
  amount: z.number().int().min(1).max(BET_RULES.maxStake),
  insure: z.boolean().optional(),
  insured: z.boolean().optional(),
  all_in: z.boolean().optional(),
  rules: RulesSchema,
})

const InsureSchema = z.object({ rules: RulesSchema })

interface PlaceRpcResult {
  bet: BetRow
  staked: number
  premium: number
  early: boolean
  raised: boolean
  all_in: boolean
  balance: number
}

interface InsureRpcResult {
  bet: BetRow
  premium: number
  balance: number
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id: sessionId } = await params
  if (!SessionIdSchema.safeParse(sessionId).success) return betError("session_not_found")
  const supabase = await createClient()
  try {
    const snapshot = await buildMarketSnapshot(supabase, sessionId, viewerId(supabase))
    return NextResponse.json(snapshot, {
      headers: { "x-server-time": snapshot.server_time, "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json({ error: "The bookmaker lost his notebook. Try again." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params
  if (!SessionIdSchema.safeParse(sessionId).success) return betError("session_not_found")
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return betError("not_authenticated")

  const parsed = PlaceSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    const sideIssue = parsed.error.issues.some((issue) => issue.path[0] === "side")
    return betError(sideIssue ? "invalid_side" : "invalid_amount")
  }
  const body = parsed.data
  const insure = body.insure ?? body.insured ?? false
  const allIn = body.all_in ?? false

  let placed: PlaceBetResult | null = null
  let response: NextResponse

  const v2 =
    body.rules === 2
      ? await supabase.rpc("place_bet_v2", {
          p_session_id: sessionId,
          p_side: body.side,
          p_amount: body.amount,
          p_insure: insure,
          p_all_in: allIn,
        })
      : null

  if (v2 && !v2.error) {
    const result = v2.data as PlaceRpcResult
    placed = { ...result, rules: 2 }
    response = NextResponse.json(placed, { status: result.raised ? 200 : 201 })
  } else if (v2?.error && !isMissingSchema(v2.error)) {
    if (allIn && /bet:invalid_amount/.test(v2.error.message ?? "")) {
      return betError("invalid_amount", "Your purse is empty. There is nothing to shove.")
    }
    return betErrorFromDb(v2.error)
  } else {
    const legacy = await legacyPlaceBet(supabase, user.id, sessionId, body.side, body.amount, insure)
    placed = legacy.placed
    response = legacy.response
  }

  if (placed) {
    const total = typeof placed.bet?.amount === "number" ? placed.bet.amount : placed.staked
    emitLive("bet.placed", {
      sessionId,
      actor: await getActor(supabase, user.id),
      data: {
        side: body.side,
        amount: placed.staked,
        insured: placed.premium > 0 || !!placed.bet?.insured,
        raised: placed.raised,
        total,
        allIn: placed.all_in,
        early: placed.early,
        whale: total >= BET_RULES.whaleAmount,
      },
    })
  }
  return response
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: sessionId } = await params
  if (!SessionIdSchema.safeParse(sessionId).success) return betError("session_not_found")
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return betError("not_authenticated")

  const parsed = InsureSchema.safeParse(await readJson(request))
  const rules = parsed.success ? parsed.data.rules : undefined

  let insured: (InsureBetResult & { side: Side; amount: number }) | null = null
  let response: NextResponse

  const v2 = rules === 2 ? await supabase.rpc("insure_bet_v2", { p_session_id: sessionId }) : null

  if (v2 && !v2.error) {
    const result = v2.data as InsureRpcResult
    insured = { ...result, rules: 2, side: result.bet.side, amount: result.bet.amount }
    response = NextResponse.json({ bet: result.bet, premium: result.premium, balance: result.balance, rules: 2 })
  } else if (v2?.error && !isMissingSchema(v2.error)) {
    return betErrorFromDb(v2.error)
  } else {
    const legacy = await legacyInsureBet(supabase, user.id, sessionId)
    insured = legacy.insured
    response = legacy.response
  }

  if (insured) {
    emitLive("bet.insured", {
      sessionId,
      actor: await getActor(supabase, user.id),
      data: { side: insured.side, amount: insured.amount, premium: insured.premium },
    })
  }
  return response
}
