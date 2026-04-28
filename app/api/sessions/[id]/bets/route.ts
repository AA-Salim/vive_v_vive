import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const supabase = await createClient()

  const { data: bets, error } = await supabase
    .from("bets")
    .select("*")
    .eq("session_id", sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allBets = bets ?? []
  const blueTotal = allBets
    .filter((b) => b.side === "blue" && b.status === "pending")
    .reduce((s, b) => s + b.amount, 0)
  const redTotal = allBets
    .filter((b) => b.side === "red" && b.status === "pending")
    .reduce((s, b) => s + b.amount, 0)
  const total = blueTotal + redTotal

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userBet = user
    ? allBets.find((b) => b.user_id === user.id) ?? null
    : null

  return NextResponse.json({
    blue_total: blueTotal,
    red_total: redTotal,
    total,
    blue_multiplier: blueTotal > 0 ? total / blueTotal : null,
    red_multiplier: redTotal > 0 ? total / redTotal : null,
    bet_count: allBets.filter((b) => b.status === "pending").length,
    user_bet: userBet,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { side, amount } = (await request.json()) as {
    side: string
    amount: number
  }

  if (!side || !["blue", "red"].includes(side)) {
    return NextResponse.json({ error: "Invalid side" }, { status: 400 })
  }
  if (!amount || amount < 1 || !Number.isInteger(amount)) {
    return NextResponse.json(
      { error: "Amount must be a positive integer" },
      { status: 400 }
    )
  }

  const { data: session } = await supabase
    .from("game_sessions")
    .select("status, betting_ends_at")
    .eq("id", sessionId)
    .single()

  if (!session || session.status !== "betting") {
    return NextResponse.json(
      { error: "Betting is not open" },
      { status: 400 }
    )
  }

  if (
    session.betting_ends_at &&
    new Date(session.betting_ends_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "Betting window has closed" },
      { status: 400 }
    )
  }

  const { error: deductError } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: -amount,
    p_reason: "bet_placed",
    p_reference_id: sessionId,
  })

  if (deductError) {
    const msg = deductError.message.includes("Insufficient")
      ? "Insufficient balance"
      : deductError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      side,
      amount,
    })
    .select()
    .single()

  if (betError) {
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: "bet_refunded",
      p_reference_id: sessionId,
    })

    if (betError.code === "23505") {
      return NextResponse.json(
        { error: "You already placed a bet on this game" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: betError.message }, { status: 500 })
  }

  return NextResponse.json(bet, { status: 201 })
}
