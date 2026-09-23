import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single()

  if (!player?.is_admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const body = await request.json()
  const { prophecy_id, correct } = body

  if (!prophecy_id || typeof correct !== "boolean") {
    return NextResponse.json(
      { error: "prophecy_id and correct (boolean) required" },
      { status: 400 }
    )
  }

  const { data: prophecy, error: fetchError } = await supabase
    .from("prophecies")
    .select("*")
    .eq("id", prophecy_id)
    .eq("session_id", sessionId)
    .single()

  if (fetchError || !prophecy) {
    return NextResponse.json({ error: "Prophecy not found" }, { status: 404 })
  }

  if (prophecy.correct !== null) {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 })
  }

  await supabase
    .from("prophecies")
    .update({ correct })
    .eq("id", prophecy_id)

  if (correct) {
    const { data: bet } = await supabase
      .from("bets")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", prophecy.user_id)
      .eq("status", "won")
      .maybeSingle()

    if (bet && bet.payout > 0) {
      const bonus = Math.floor(bet.payout * (prophecy.multiplier - 1))
      if (bonus > 0) {
        await supabase.rpc("adjust_balance", {
          p_user_id: prophecy.user_id,
          p_amount: bonus,
          p_reason: "prophecy_bonus",
          p_reference_id: sessionId,
        })
      }
    }
  }

  return NextResponse.json({ resolved: true, correct })
}
