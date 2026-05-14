import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("shame_entries")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const entries = data ?? []

  // Enrich with shamer usernames and target player names
  const shamerIds = [...new Set(entries.map((e) => e.shamer_user_id))]
  const targetIds = [...new Set(entries.map((e) => e.target_player_id))]

  const profileMap = new Map<string, { discord_username: string; discord_avatar_url: string | null }>()
  const playerMap = new Map<string, string>()

  if (shamerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, discord_username, discord_avatar_url")
      .in("id", shamerIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { discord_username: p.discord_username, discord_avatar_url: p.discord_avatar_url })
    }
  }

  if (targetIds.length > 0) {
    const { data: players } = await supabase
      .from("players")
      .select("id, name")
      .in("id", targetIds)
    for (const p of players ?? []) {
      playerMap.set(p.id, p.name)
    }
  }

  const enriched = entries.map((e) => ({
    ...e,
    shamer_username: profileMap.get(e.shamer_user_id)?.discord_username ?? "Unknown",
    shamer_avatar_url: profileMap.get(e.shamer_user_id)?.discord_avatar_url ?? null,
    target_player_name: playerMap.get(e.target_player_id) ?? "Unknown",
  }))

  return NextResponse.json(enriched)
}

async function computeWorstStat(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  targetPlayerId: string
) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentGames } = await supabase
    .from("game_players")
    .select("side, lane, champion, games!inner(played_at, winner_side)")
    .eq("player_id", targetPlayerId)
    .gte("games.played_at", oneWeekAgo)

  if (!recentGames || recentGames.length === 0) {
    return { label: "Games This Week", value: "0 (hiding?)" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const games = recentGames as any[]
  const wins = games.filter((g) => g.side === g.games.winner_side).length
  const losses = games.length - wins
  const winRate = Math.round((wins / games.length) * 100)

  // Per-lane breakdown
  const laneStats = new Map<string, { wins: number; total: number }>()
  for (const g of games) {
    const entry = laneStats.get(g.lane) ?? { wins: 0, total: 0 }
    entry.total++
    if (g.side === g.games.winner_side) entry.wins++
    laneStats.set(g.lane, entry)
  }

  // Find worst lane (min win rate with at least 2 games)
  let worstLane: { lane: string; rate: number } | null = null
  for (const [lane, stats] of laneStats) {
    if (stats.total >= 2) {
      const rate = Math.round((stats.wins / stats.total) * 100)
      if (!worstLane || rate < worstLane.rate) {
        worstLane = { lane, rate }
      }
    }
  }

  if (wins === 0) {
    return { label: "Win Rate This Week", value: `0% (0-${losses})` }
  }
  if (winRate <= 30) {
    return { label: "Win Rate This Week", value: `${winRate}% (${wins}-${losses})` }
  }
  if (worstLane && worstLane.rate <= 25) {
    return { label: `${worstLane.lane.toUpperCase()} Win Rate`, value: `${worstLane.rate}%` }
  }
  if (winRate <= 45) {
    return { label: "Win Rate This Week", value: `${winRate}% (${wins}-${losses})` }
  }
  return { label: "Record This Week", value: `${wins}-${losses}` }
}

async function fetchRecentLosses(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  targetPlayerId: string
) {
  const { data } = await supabase
    .from("game_players")
    .select("side, lane, champion, games!inner(played_at, winner_side)")
    .eq("player_id", targetPlayerId)
    .order("games(played_at)", { ascending: false })
    .limit(20)

  if (!data) return []

  const losses = (data as unknown as Array<{ side: string; lane: string; champion: string; games: { played_at: string; winner_side: string } }>)
    .filter((g) => g.side !== g.games.winner_side)
    .slice(0, 5)
    .map((g) => ({
      played_at: g.games.played_at,
      champion: g.champion,
      lane: g.lane,
      winner_side: g.games.winner_side,
      player_side: g.side,
    }))

  return losses
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 })
  }

  const { target_player_id, message } = await request.json()

  if (!target_player_id) {
    return NextResponse.json({ error: "target_player_id required" }, { status: 400 })
  }

  if (message && message.length > 200) {
    return NextResponse.json({ error: "Message must be 200 characters or less" }, { status: 400 })
  }

  // Block self-shame
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("player_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.player_id === target_player_id) {
    return NextResponse.json({ error: "You cannot shame yourself" }, { status: 400 })
  }

  // 24h cooldown
  const cooldownTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentShame } = await supabase
    .from("shame_entries")
    .select("id")
    .eq("shamer_user_id", user.id)
    .gte("created_at", cooldownTime)
    .limit(1)
    .maybeSingle()

  if (recentShame) {
    return NextResponse.json(
      { error: "You can only shame once every 24 hours" },
      { status: 400 }
    )
  }

  // Validate target exists
  const { data: targetPlayer } = await supabase
    .from("players")
    .select("id, name")
    .eq("id", target_player_id)
    .single()

  if (!targetPlayer) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }

  // Compute worst stat
  const worstStat = await computeWorstStat(supabase, target_player_id)

  // Fetch recent losses
  const recentLosses = await fetchRecentLosses(supabase, target_player_id)

  // Deduct 234 points
  const { error: balError } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: -234,
    p_reason: "shame_spent",
  })

  if (balError) {
    return NextResponse.json({ error: "Insufficient balance (234 pts required)" }, { status: 400 })
  }

  // Insert shame entry
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: entry, error: insertError } = await supabase
    .from("shame_entries")
    .insert({
      shamer_user_id: user.id,
      target_player_id,
      message: message || "",
      worst_stat_label: worstStat.label,
      worst_stat_value: worstStat.value,
      recent_losses: recentLosses,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (insertError) {
    // Refund if insert fails
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: 234,
      p_reason: "shame_spent",
    })
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(entry, { status: 201 })
}
