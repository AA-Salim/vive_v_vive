import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { DAILY_STIPEND } from "@/lib/lore/daily"
import { noteText, parseNotes, stipendTerms } from "@/lib/titles/effects"
import { loadUserEffects } from "@/lib/titles/server"

interface StipendClaim {
  claimed: boolean
  balance: number
  amount: number
  paid_to_salaxe: boolean
  title_effects: string[]
}

async function salaxeUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("players")
    .select("auth_user_id")
    .ilike("name", "salaxe")
    .not("auth_user_id", "is", null)
    .limit(1)
    .maybeSingle()
  return (data?.auth_user_id as string | null | undefined) ?? null
}

function adjust(supabase: SupabaseClient, userId: string, amount: number, reason: string, referenceId: string | null) {
  return supabase.rpc("adjust_balance", { p_user_id: userId, p_amount: amount, p_reason: reason, p_reference_id: referenceId })
}

// Before phase10_title-effects.sql the database pays the plain stipend: the title effects are applied here, best
// effort (a refused write only means no effect).
async function applyLegacyEffects(supabase: SupabaseClient, userId: string, balance: number): Promise<StipendClaim> {
  const terms = stipendTerms(await loadUserEffects(supabase, userId))
  const lines = terms.notes.map(noteText)
  const salaxe = terms.toSalaxe ? await salaxeUserId(supabase) : null
  if (terms.toSalaxe && salaxe && salaxe !== userId) {
    const tribute = await adjust(supabase, salaxe, terms.amount, "title_stipend_tribute", userId)
    if (!tribute.error) {
      const back = await adjust(supabase, userId, -DAILY_STIPEND, "title_stipend_redirected", salaxe)
      if (!back.error) return { claimed: true, balance: Number(back.data), amount: terms.amount, paid_to_salaxe: true, title_effects: lines }
    }
    return { claimed: true, balance, amount: DAILY_STIPEND, paid_to_salaxe: false, title_effects: [] }
  }
  if (terms.amount > DAILY_STIPEND) {
    const bonus = await adjust(supabase, userId, terms.amount - DAILY_STIPEND, "title_stipend_bonus", null)
    if (!bonus.error) return { claimed: true, balance: Number(bonus.data), amount: terms.amount, paid_to_salaxe: false, title_effects: lines }
  }
  return { claimed: true, balance, amount: DAILY_STIPEND, paid_to_salaxe: false, title_effects: [] }
}

async function claim(supabase: SupabaseClient, userId: string): Promise<StipendClaim | { error: string } | null> {
  // claim_my_daily_stipend (phase10_title-effects.sql) claims for the caller only, titles included.
  const stipend = await supabase.rpc("claim_my_daily_stipend")
  if (!stipend.error) {
    const r = stipend.data as { claimed: boolean; balance: number; amount?: number; paid_to_salaxe?: boolean; title_effects?: unknown }
    if (!r.claimed) return null
    return {
      claimed: true,
      balance: r.balance,
      amount: r.amount ?? DAILY_STIPEND,
      paid_to_salaxe: !!r.paid_to_salaxe,
      title_effects: parseNotes(r.title_effects).map(noteText),
    }
  }
  if (!isMissingSchema(stipend.error)) return { error: stipend.error.message }

  // claim_my_daily_bonus (phase10_hardening.sql) only ever claims for the caller.
  let { data: newBalance, error } = await supabase.rpc("claim_my_daily_bonus")
  if (error && isMissingSchema(error)) {
    ;({ data: newBalance, error } = await supabase.rpc("claim_daily_bonus", { p_user_id: userId }))
  }
  if (error) return { error: error.message }
  if (newBalance === -1) return null
  return applyLegacyEffects(supabase, userId, newBalance as number)
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const result = await claim(supabase, user.id)
  if (result && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  if (!result) {
    return NextResponse.json({ already_claimed: true })
  }

  const titleEffects = result.title_effects.length ? result.title_effects : undefined
  emitLive("points.changed", {
    actor: null,
    data: { userId: user.id, delta: result.paid_to_salaxe ? 0 : result.amount, reason: "daily_bonus", titleEffects },
    persist: false,
  })
  if (result.paid_to_salaxe) {
    const salaxe = await salaxeUserId(supabase)
    if (salaxe) {
      emitLive("points.changed", {
        actor: null,
        data: { userId: salaxe, delta: result.amount, reason: "title_stipend_tribute", titleEffects },
        persist: false,
      })
    }
  }

  return NextResponse.json(result)
}
