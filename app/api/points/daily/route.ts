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

  const { data: newBalance, error } = await supabase.rpc("claim_daily_bonus", {
    p_user_id: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (newBalance === -1) {
    return NextResponse.json({ already_claimed: true })
  }

  return NextResponse.json({ claimed: true, balance: newBalance })
}
