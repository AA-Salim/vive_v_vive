import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { BET_RULES } from "@/lib/betting/rules"
import { betError, betErrorFromDb } from "@/lib/betting/server/respond"
import type { InsureBetResult, PlaceBetResult } from "@/lib/betting/types"
import type { Side } from "@/lib/types"

// Pre-migration betting flow, kept so bets keep working until phase10_betting.sql is applied.

async function openWindowError(supabase: SupabaseClient, sessionId: string) {
  const { data: session } = await supabase
    .from("game_sessions")
    .select("status, betting_ends_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (!session) return betError("session_not_found")
  if (session.status !== "betting") return betError("betting_closed")
  if (session.betting_ends_at && new Date(session.betting_ends_at) < new Date()) return betError("betting_closed")
  return null
}

function adjust(supabase: SupabaseClient, userId: string, amount: number, reason: string, referenceId: string) {
  return supabase.rpc("adjust_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId,
  })
}

export async function legacyPlaceBet(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  side: Side,
  amount: number,
  insure: boolean
): Promise<{ response: NextResponse; placed: PlaceBetResult | null }> {
  const closed = await openWindowError(supabase, sessionId)
  if (closed) return { response: closed, placed: null }

  const stake = await adjust(supabase, userId, -amount, "bet_placed", sessionId)
  if (stake.error) return { response: betErrorFromDb(stake.error), placed: null }

  let premium = 0
  if (insure) {
    const ins = await adjust(supabase, userId, -BET_RULES.legacyPremium, "insurance_bought", sessionId)
    if (ins.error) {
      await adjust(supabase, userId, amount, "bet_refunded", sessionId)
      return { response: betErrorFromDb(ins.error), placed: null }
    }
    premium = BET_RULES.legacyPremium
  }

  const { data: bet, error } = await supabase
    .from("bets")
    .insert({ session_id: sessionId, user_id: userId, side, amount, insured: premium > 0 })
    .select()
    .single()

  if (error) {
    await adjust(supabase, userId, amount, "bet_refunded", sessionId)
    if (premium > 0) await adjust(supabase, userId, premium, "insurance_refunded", sessionId)
    const response =
      error.code === "23505"
        ? NextResponse.json({ error: "You already placed a bet on this game.", code: "duplicate" }, { status: 409 })
        : betErrorFromDb(error)
    return { response, placed: null }
  }

  const placed: PlaceBetResult = {
    bet,
    staked: amount,
    premium,
    early: false,
    raised: false,
    all_in: false,
    balance: typeof stake.data === "number" ? stake.data - premium : null,
    rules: 1,
  }
  return { response: NextResponse.json({ ...bet, ...placed }, { status: 201 }), placed }
}

export async function legacyInsureBet(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ response: NextResponse; insured: (InsureBetResult & { side: Side; amount: number }) | null }> {
  const closed = await openWindowError(supabase, sessionId)
  if (closed) return { response: closed, insured: null }

  const { data: bet } = await supabase
    .from("bets")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!bet) return { response: betError("no_bet"), insured: null }
  if (bet.scheme === "v2") return { response: betError("refresh_required"), insured: null }
  if (bet.insured) return { response: betError("already_insured"), insured: null }
  if (bet.status !== "pending") return { response: betError("bet_settled"), insured: null }

  const charge = await adjust(supabase, userId, -BET_RULES.legacyPremium, "insurance_bought", bet.id)
  if (charge.error) return { response: betErrorFromDb(charge.error), insured: null }

  const { data: updated } = await supabase.from("bets").update({ insured: true }).eq("id", bet.id).select("id")
  if (!updated || updated.length === 0) {
    await adjust(supabase, userId, BET_RULES.legacyPremium, "insurance_refunded", bet.id)
    return {
      response: NextResponse.json(
        { error: "Insurance could not be attached to this bet. Your premium was returned.", code: "insurance_unavailable" },
        { status: 409 }
      ),
      insured: null,
    }
  }

  const insured = {
    bet: { ...bet, insured: true },
    premium: BET_RULES.legacyPremium,
    balance: typeof charge.data === "number" ? charge.data : null,
    rules: 1 as const,
    side: bet.side as Side,
    amount: bet.amount as number,
  }
  return { response: NextResponse.json({ ...bet, insured: true, premium: insured.premium, balance: insured.balance, rules: 1 }), insured }
}
