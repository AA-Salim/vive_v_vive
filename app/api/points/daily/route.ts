import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]

  const { data: balance } = await supabase
    .from("point_balances")
    .select("last_daily_claim")
    .eq("user_id", user.id)
    .single()

  if (!balance) {
    return NextResponse.json(
      { error: "Balance not initialized" },
      { status: 400 }
    )
  }

  if (balance.last_daily_claim === today) {
    return NextResponse.json({ already_claimed: true })
  }

  const { data: newBalance, error } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: 5,
    p_reason: "daily_bonus",
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from("point_balances")
    .update({ last_daily_claim: today })
    .eq("user_id", user.id)

  return NextResponse.json({ claimed: true, balance: newBalance })
}
