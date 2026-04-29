import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: bets, error } = await supabase
    .from("bets")
    .select("*")
    .in("status", ["won", "lost", "refunded"])
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allBets = bets ?? []
  if (allBets.length === 0) {
    return NextResponse.json({ bets: [] })
  }

  const userIds = [...new Set(allBets.map((b) => b.user_id))]
  const sessionIds = [...new Set(allBets.map((b) => b.session_id))]

  const [profilesResult, sessionsResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, discord_username, discord_avatar_url, player_id")
      .in("id", userIds),
    supabase
      .from("game_sessions")
      .select("id, status, created_at")
      .in("id", sessionIds),
  ])

  const { data: players } = await supabase
    .from("players")
    .select("id, name")

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )
  const playerMap = new Map(
    (players ?? []).map((p) => [p.id, p.name])
  )
  const sessionMap = new Map(
    (sessionsResult.data ?? []).map((s) => [s.id, s])
  )

  const enriched = allBets.map((b) => {
    const profile = profileMap.get(b.user_id)
    const session = sessionMap.get(b.session_id)
    const playerName = profile?.player_id
      ? playerMap.get(profile.player_id) ?? null
      : null

    return {
      id: b.id,
      side: b.side,
      amount: b.amount,
      payout: b.payout,
      status: b.status,
      created_at: b.created_at,
      discord_username: profile?.discord_username ?? "Unknown",
      discord_avatar_url: profile?.discord_avatar_url ?? null,
      player_name: playerName,
      session_status: session?.status ?? null,
      session_date: session?.created_at ?? null,
    }
  })

  return NextResponse.json({ bets: enriched })
}
