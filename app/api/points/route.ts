import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: balance } = await supabase
    .from("point_balances")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  const { data: transactions } = await supabase
    .from("point_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    balance: balance?.balance ?? 0,
    last_daily_claim: balance?.last_daily_claim ?? null,
    transactions: transactions ?? [],
  })
}
