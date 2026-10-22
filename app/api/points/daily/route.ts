import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { DAILY_STIPEND } from "@/lib/lore/daily"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // claim_my_daily_bonus (phase10_hardening.sql) only ever claims for the caller.
  let { data: newBalance, error } = await supabase.rpc("claim_my_daily_bonus")
  if (error && isMissingSchema(error)) {
    ;({ data: newBalance, error } = await supabase.rpc("claim_daily_bonus", { p_user_id: user.id }))
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (newBalance === -1) {
    return NextResponse.json({ already_claimed: true })
  }

  emitLive("points.changed", {
    actor: null,
    data: { userId: user.id, delta: DAILY_STIPEND, reason: "daily_bonus" },
    persist: false,
  })

  return NextResponse.json({ claimed: true, balance: newBalance })
}
