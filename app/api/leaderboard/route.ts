import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: balances, error: balError } = await supabase
    .from("point_balances")
    .select("user_id, balance")
    .order("balance", { ascending: false })

  if (balError) {
    return NextResponse.json({ error: balError.message }, { status: 500 })
  }

  if (!balances || balances.length === 0) {
    return NextResponse.json({ leaderboard: [] })
  }

  const userIds = balances.map((b) => b.user_id)

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, discord_username, discord_avatar_url, player_id")
    .in("id", userIds)

  const { data: players } = await supabase
    .from("players")
    .select("id, name")

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  )
  const playerMap = new Map(
    (players ?? []).map((p) => [p.id, p.name])
  )

  const { data: lastTxns } = await supabase
    .from("point_transactions")
    .select("user_id, amount, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })

  const lastTxMap = new Map<string, number>()
  for (const tx of lastTxns ?? []) {
    if (!lastTxMap.has(tx.user_id)) {
      lastTxMap.set(tx.user_id, tx.amount)
    }
  }

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  const leaderboard = balances.map((b, i) => {
    const profile = profileMap.get(b.user_id)
    const playerName = profile?.player_id
      ? playerMap.get(profile.player_id) ?? null
      : null

    return {
      rank: i + 1,
      user_id: b.user_id,
      username: profile?.discord_username ?? "Unknown",
      avatar_url: profile?.discord_avatar_url ?? null,
      player_name: playerName,
      balance: b.balance,
      last_change: lastTxMap.get(b.user_id) ?? null,
      is_current_user: currentUser?.id === b.user_id,
    }
  })

  return NextResponse.json({ leaderboard })
}
