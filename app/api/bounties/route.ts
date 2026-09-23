import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: bounties } = await supabase
    .from("bounties")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (!bounties || bounties.length === 0) {
    return NextResponse.json({ bounties: [] })
  }

  const posterIds = [...new Set(bounties.map((b) => b.poster_user_id))]
  const targetIds = [...new Set(bounties.map((b) => b.target_player_id))]

  const [profilesResult, playersResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, discord_username, discord_avatar_url")
      .in("id", posterIds),
    supabase.from("players").select("id, name").in("id", targetIds),
  ])

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )
  const playerMap = new Map(
    (playersResult.data ?? []).map((p) => [p.id, p.name])
  )

  const enriched = bounties.map((b) => ({
    ...b,
    poster_username: profileMap.get(b.poster_user_id)?.discord_username ?? "Unknown",
    poster_avatar_url: profileMap.get(b.poster_user_id)?.discord_avatar_url ?? null,
    target_player_name: playerMap.get(b.target_player_id) ?? "Unknown",
  }))

  return NextResponse.json({ bounties: enriched })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { target_player_id, amount } = body

  if (!target_player_id || !amount || amount < 10) {
    return NextResponse.json(
      { error: "target_player_id and amount (min 10) required" },
      { status: 400 }
    )
  }

  if (amount > 500) {
    return NextResponse.json(
      { error: "Maximum bounty is 500 points" },
      { status: 400 }
    )
  }

  // Check for existing active bounty
  const { data: existing } = await supabase
    .from("bounties")
    .select("id")
    .eq("poster_user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "You already have an active bounty" },
      { status: 400 }
    )
  }

  // Can't bounty yourself
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("player_id")
    .eq("id", user.id)
    .single()

  if (profile?.player_id === target_player_id) {
    return NextResponse.json(
      { error: "Cannot place a bounty on yourself" },
      { status: 400 }
    )
  }

  // Deduct points
  const { error: balanceError } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: -amount,
    p_reason: "bounty_placed",
  })

  if (balanceError) {
    return NextResponse.json(
      { error: balanceError.message },
      { status: 400 }
    )
  }

  // Create bounty (expires in 7 days)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data: bounty, error: insertError } = await supabase
    .from("bounties")
    .insert({
      poster_user_id: user.id,
      target_player_id,
      amount,
      payout_multiplier: 1.5,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    // Refund
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: "bounty_expired_refund",
    })
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ placed: true, bounty })
}
