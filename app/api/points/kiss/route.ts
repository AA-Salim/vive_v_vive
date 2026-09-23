import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const PRAISE_REASONS = ["kiss_the_hand", "sing_his_praises"]

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]

  const [todayResult, totalResult] = await Promise.all([
    supabase
      .from("point_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("reason", PRAISE_REASONS)
      .gte("created_at", `${today}T00:00:00Z`),
    supabase
      .from("point_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("reason", PRAISE_REASONS),
  ])

  const usedToday = todayResult.count ?? 0
  const totalKisses = totalResult.count ?? 0

  return NextResponse.json({
    used_today: usedToday,
    remaining_today: Math.max(0, 3 - usedToday),
    total_kisses: totalKisses,
  })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]

  const { count } = await supabase
    .from("point_transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("reason", PRAISE_REASONS)
    .gte("created_at", `${today}T00:00:00Z`)

  const usedToday = count ?? 0

  if (usedToday >= 3) {
    return NextResponse.json({ exhausted: true, remaining_today: 0 })
  }

  // Determine reason based on active act
  const { data: activeAct } = await supabase
    .from("acts")
    .select("act_number")
    .eq("status", "active")
    .maybeSingle()

  const reason =
    activeAct && activeAct.act_number >= 2
      ? "sing_his_praises"
      : "kiss_the_hand"

  const { data: newBalance, error } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: 10,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    kissed: true,
    balance: newBalance,
    remaining_today: 2 - usedToday,
  })
}
