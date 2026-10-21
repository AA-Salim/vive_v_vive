import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import type { PraiseStateRow } from "@/lib/praise/server"

const DEVOTION_REASONS = ["kiss_the_hand", "sing_his_praises"]

// Legacy shape consumed by hooks/use-points.ts, now derived from written praises (one per day).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const [stateResult, totalResult] = await Promise.all([
    supabase.rpc("praise_state"),
    supabase
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("reason", DEVOTION_REASONS),
  ])

  const state = stateResult.error ? null : (stateResult.data as PraiseStateRow)
  const usedToday = state?.today_id ? 1 : 0

  return NextResponse.json({
    used_today: usedToday,
    remaining_today: state ? 1 - usedToday : 0,
    total_kisses: totalResult.count ?? 0,
  })
}

// Old clients could farm points with one click. Praise must now be written through POST /api/praise.
export async function POST() {
  return NextResponse.json(
    {
      error: "The hand-kissing era is over. Salaxe only accepts written praise now: open Sing His Praises and write one.",
      code: "praise_requires_text",
      remaining_today: 0,
    },
    { status: 410 }
  )
}
