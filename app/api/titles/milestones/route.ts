import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { MILESTONES } from "@/lib/milestones"

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("player_id")
    .eq("id", user.id)
    .maybeSingle()

  const playerId = profile?.player_id ?? null

  const stats: Record<string, number> = {
    games_played: 0,
    wins: 0,
    win_rate: 0,
    bets_placed: 0,
    bets_won: 0,
    total_earned: 0,
    devotion_count: 0,
    shames_received: 0,
    chaos_used: 0,
    bounties_placed: 0,
  }

  if (playerId) {
    const { data: player } = await supabase
      .from("players")
      .select("games_played, wins")
      .eq("id", playerId)
      .single()

    if (player) {
      stats.games_played = player.games_played
      stats.wins = player.wins
      stats.win_rate = player.games_played >= 10
        ? (player.wins / player.games_played) * 100
        : 0
    }

    const { count: shameCount } = await supabase
      .from("shame_entries")
      .select("id", { count: "exact", head: true })
      .eq("target_player_id", playerId)

    stats.shames_received = shameCount ?? 0
  }

  const { count: betCount } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  stats.bets_placed = betCount ?? 0

  const { count: betWinCount } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("result", "won")

  stats.bets_won = betWinCount ?? 0

  const { data: earnedTxns } = await supabase
    .from("point_transactions")
    .select("amount")
    .eq("user_id", user.id)
    .gt("amount", 0)

  stats.total_earned = (earnedTxns ?? []).reduce((sum, t) => sum + t.amount, 0)

  const { count: devotionCount } = await supabase
    .from("point_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("reason", ["kiss_the_hand", "sing_his_praises"])

  stats.devotion_count = devotionCount ?? 0

  const { count: chaosCount } = await supabase
    .from("chaos_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  stats.chaos_used = chaosCount ?? 0

  const { count: bountyCount } = await supabase
    .from("bounties")
    .select("id", { count: "exact", head: true })
    .eq("poster_user_id", user.id)

  stats.bounties_placed = bountyCount ?? 0

  const { data: ownedTitles } = await supabase
    .from("user_titles")
    .select("titles:title_id (name)")
    .eq("user_id", user.id)

  const ownedNames = new Set(
    (ownedTitles ?? []).map((ut) => {
      const t = ut.titles as unknown as { name: string } | null
      return t?.name ?? ""
    })
  )

  const milestones = MILESTONES.map((m) => {
    const current = stats[m.stat] ?? 0
    const unlocked = current >= m.threshold
    const claimed = ownedNames.has(m.title)
    return {
      ...m,
      current: Math.floor(current * 100) / 100,
      unlocked,
      claimed,
    }
  })

  return NextResponse.json({ milestones, stats })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { milestone_id } = body

  if (!milestone_id) {
    return NextResponse.json({ error: "milestone_id required" }, { status: 400 })
  }

  const milestone = MILESTONES.find((m) => m.id === milestone_id)
  if (!milestone) {
    return NextResponse.json({ error: "Unknown milestone" }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("player_id")
    .eq("id", user.id)
    .maybeSingle()

  const playerId = profile?.player_id ?? null
  let statValue = 0

  if (milestone.stat === "games_played" || milestone.stat === "wins" || milestone.stat === "win_rate") {
    if (!playerId) {
      return NextResponse.json({ error: "No linked player" }, { status: 400 })
    }
    const { data: player } = await supabase
      .from("players")
      .select("games_played, wins")
      .eq("id", playerId)
      .single()
    if (player) {
      if (milestone.stat === "games_played") statValue = player.games_played
      else if (milestone.stat === "wins") statValue = player.wins
      else if (milestone.stat === "win_rate" && player.games_played >= 10)
        statValue = (player.wins / player.games_played) * 100
    }
  } else if (milestone.stat === "shames_received") {
    if (!playerId) {
      return NextResponse.json({ error: "No linked player" }, { status: 400 })
    }
    const { count } = await supabase
      .from("shame_entries")
      .select("id", { count: "exact", head: true })
      .eq("target_player_id", playerId)
    statValue = count ?? 0
  } else if (milestone.stat === "bets_placed") {
    const { count } = await supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
    statValue = count ?? 0
  } else if (milestone.stat === "bets_won") {
    const { count } = await supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("result", "won")
    statValue = count ?? 0
  } else if (milestone.stat === "total_earned") {
    const { data: txns } = await supabase
      .from("point_transactions")
      .select("amount")
      .eq("user_id", user.id)
      .gt("amount", 0)
    statValue = (txns ?? []).reduce((sum, t) => sum + t.amount, 0)
  } else if (milestone.stat === "devotion_count") {
    const { count } = await supabase
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("reason", ["kiss_the_hand", "sing_his_praises"])
    statValue = count ?? 0
  } else if (milestone.stat === "chaos_used") {
    const { count } = await supabase
      .from("chaos_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
    statValue = count ?? 0
  } else if (milestone.stat === "bounties_placed") {
    const { count } = await supabase
      .from("bounties")
      .select("id", { count: "exact", head: true })
      .eq("poster_user_id", user.id)
    statValue = count ?? 0
  }

  if (statValue < milestone.threshold) {
    return NextResponse.json({ error: "Milestone not reached" }, { status: 400 })
  }

  let { data: title } = await supabase
    .from("titles")
    .select("id")
    .eq("name", milestone.title)
    .maybeSingle()

  if (!title) {
    const { data: created } = await supabase
      .from("titles")
      .insert({
        name: milestone.title,
        description: milestone.description,
        price: 0,
        category: "award",
        for_self: true,
        is_permanent: true,
      })
      .select("id")
      .single()
    title = created
  }

  if (!title) {
    return NextResponse.json({ error: "Failed to create title" }, { status: 500 })
  }

  const { data: existing } = await supabase
    .from("user_titles")
    .select("id")
    .eq("user_id", user.id)
    .eq("title_id", title.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  }

  await supabase.from("user_titles").insert({
    user_id: user.id,
    title_id: title.id,
    is_active: false,
  })

  return NextResponse.json({ claimed: true, title: milestone.title })
}
