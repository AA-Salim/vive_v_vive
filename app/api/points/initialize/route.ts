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

  const { data: existing } = await supabase
    .from("point_balances")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ already_initialized: true })
  }

  const { error: balanceError } = await supabase
    .from("point_balances")
    .insert({ user_id: user.id, balance: 50 })

  if (balanceError) {
    return NextResponse.json(
      { error: balanceError.message },
      { status: 500 }
    )
  }

  const { error: txError } = await supabase
    .from("point_transactions")
    .insert({
      user_id: user.id,
      amount: 50,
      reason: "initial_grant",
    })

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  return NextResponse.json({ initialized: true, balance: 50 })
}
