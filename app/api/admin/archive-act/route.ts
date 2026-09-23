import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { ACT_CATEGORIES } from "@/lib/acts"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const body = await request.json().catch(() => ({}))
  let targetAct = null

  if (body.act_id) {
    const { data: act } = await supabase
      .from("acts")
      .select("*")
      .eq("id", body.act_id)
      .single()
    if (!act) {
      return NextResponse.json({ error: "Act not found" }, { status: 404 })
    }
    const { data: existingAwards } = await supabase
      .from("act_awards")
      .select("id")
      .eq("act_id", act.id)
      .limit(1)
    if (existingAwards && existingAwards.length > 0) {
      return NextResponse.json(
        { error: "Awards already computed for this act" },
        { status: 400 }
      )
    }
    targetAct = act
  } else {
    const { data: act } = await supabase
      .from("acts")
      .select("*")
      .eq("status", "active")
      .maybeSingle()
    targetAct = act
  }

  if (!targetAct) {
    return NextResponse.json(
      { error: "No act to archive. Pass { act_id } for a specific act." },
      { status: 400 }
    )
  }

  const activeAct = targetAct
  const actStarted = activeAct.started_at
  const actEnded = activeAct.ended_at ?? new Date().toISOString()

  // ---- Compute award winners ----

  // Treasury: highest balance
  const { data: balances } = await supabase
    .from("point_balances")
    .select("user_id, balance")
    .order("balance", { ascending: false })

  // All profiles and players for lookups
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, discord_username, discord_avatar_url, player_id")

  const { data: allPlayers } = await supabase.from("players").select("*")

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const playerMap = new Map((allPlayers ?? []).map((p) => [p.id, p]))
  const playerByAuth = new Map(
    (allPlayers ?? [])
      .filter((p) => p.auth_user_id)
      .map((p) => [p.auth_user_id!, p])
  )

  // Warrior: best win rate (min 5 games) - need user_id via auth_user_id
  const linkedPlayers = (allPlayers ?? []).filter(
    (p) => p.auth_user_id && p.games_played >= 5
  )
  const warrior = linkedPlayers.sort((a, b) => {
    const rateA = a.games_played > 0 ? a.wins / a.games_played : 0
    const rateB = b.games_played > 0 ? b.wins / b.games_played : 0
    return rateB - rateA
  })[0]

  // Iron Man: most games played
  const ironMan = (allPlayers ?? [])
    .filter((p) => p.auth_user_id)
    .sort((a, b) => b.games_played - a.games_played)[0]

  // Degenerate: most bets placed (within act timeframe)
  const { data: allBets } = await supabase
    .from("bets")
    .select("user_id, created_at")
    .gte("created_at", actStarted)
    .lte("created_at", actEnded)

  const betCountMap = new Map<string, number>()
  for (const bet of allBets ?? []) {
    betCountMap.set(bet.user_id, (betCountMap.get(bet.user_id) ?? 0) + 1)
  }
  const degenerateEntry = [...betCountMap.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]

  // Devotee: most kisses
  const { data: kissTxns } = await supabase
    .from("point_transactions")
    .select("user_id")
    .eq("reason", "kiss_the_hand")
    .gte("created_at", actStarted)
    .lte("created_at", actEnded)

  const kissCountMap = new Map<string, number>()
  for (const tx of kissTxns ?? []) {
    kissCountMap.set(tx.user_id, (kissCountMap.get(tx.user_id) ?? 0) + 1)
  }
  const devoteeEntry = [...kissCountMap.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]

  // Punching Bag: most times shamed
  const { data: shameEntries } = await supabase
    .from("shame_entries")
    .select("target_player_id")
    .gte("created_at", actStarted)
    .lte("created_at", actEnded)

  const shameCountMap = new Map<string, number>()
  for (const entry of shameEntries ?? []) {
    shameCountMap.set(
      entry.target_player_id,
      (shameCountMap.get(entry.target_player_id) ?? 0) + 1
    )
  }
  const punchingBagEntry = [...shameCountMap.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]

  function getUserId(playerId: string): string | null {
    const p = playerMap.get(playerId)
    return p?.auth_user_id ?? null
  }

  function getPlayerId(userId: string): string | null {
    const profile = profileMap.get(userId)
    return profile?.player_id ?? null
  }

  const treasuryUser = balances?.[0]
  const awards: {
    category: string
    user_id: string
    player_id: string | null
    title: string
    carry_over_bonus: number
    final_value: string
    perks: Record<string, unknown>
  }[] = []

  if (treasuryUser) {
    awards.push({
      category: "treasury",
      user_id: treasuryUser.user_id,
      player_id: getPlayerId(treasuryUser.user_id),
      title: `Act ${activeAct.act_number} Grand Champion`,
      carry_over_bonus: 150,
      final_value: `${treasuryUser.balance} pts`,
      perks: { free_shame: true, free_chaos: true, writes_broadcast: true },
    })
    awards.push({
      category: "grand_champion",
      user_id: treasuryUser.user_id,
      player_id: getPlayerId(treasuryUser.user_id),
      title: `Act ${activeAct.act_number} Grand Champion`,
      carry_over_bonus: 0,
      final_value: `${treasuryUser.balance} pts`,
      perks: { free_shame: true, free_chaos: true, writes_broadcast: true },
    })
  }

  if (warrior) {
    const rate = ((warrior.wins / warrior.games_played) * 100).toFixed(1)
    awards.push({
      category: "warrior",
      user_id: warrior.auth_user_id!,
      player_id: warrior.id,
      title: `Act ${activeAct.act_number} Warrior`,
      carry_over_bonus: 50,
      final_value: `${rate}% win rate`,
      perks: {},
    })
  }

  if (ironMan) {
    awards.push({
      category: "iron_man",
      user_id: ironMan.auth_user_id!,
      player_id: ironMan.id,
      title: `Act ${activeAct.act_number} Iron Man`,
      carry_over_bonus: 50,
      final_value: `${ironMan.games_played} games`,
      perks: {},
    })
  }

  if (degenerateEntry) {
    awards.push({
      category: "degenerate",
      user_id: degenerateEntry[0],
      player_id: getPlayerId(degenerateEntry[0]),
      title: `Act ${activeAct.act_number} Degenerate`,
      carry_over_bonus: 50,
      final_value: `${degenerateEntry[1]} bets`,
      perks: {},
    })
  }

  if (devoteeEntry) {
    awards.push({
      category: "devotee",
      user_id: devoteeEntry[0],
      player_id: getPlayerId(devoteeEntry[0]),
      title: `Act ${activeAct.act_number} Devotee`,
      carry_over_bonus: 50,
      final_value: `${devoteeEntry[1]} kisses`,
      perks: {},
    })
  }

  if (punchingBagEntry) {
    const punchingBagUserId = getUserId(punchingBagEntry[0])
    if (punchingBagUserId) {
      awards.push({
        category: "punching_bag",
        user_id: punchingBagUserId,
        player_id: punchingBagEntry[0],
        title: `Act ${activeAct.act_number} Punching Bag`,
        carry_over_bonus: 50,
        final_value: `${punchingBagEntry[1]} times shamed`,
        perks: {},
      })
    }
  }

  // Filter duplicate categories (treasury and grand_champion share user)
  const seenCategories = new Set<string>()
  const uniqueAwards = awards.filter((a) => {
    if (seenCategories.has(a.category)) return false
    seenCategories.add(a.category)
    return true
  })

  // Insert awards
  for (const award of uniqueAwards) {
    await supabase.from("act_awards").insert({
      act_id: activeAct.id,
      ...award,
    })
  }

  // ---- Snapshot all users ----
  const { data: allTxns } = await supabase
    .from("point_transactions")
    .select("user_id, amount, reason")
    .gte("created_at", actStarted)
    .lte("created_at", actEnded)

  const txnStats = new Map<
    string,
    { earned: number; spent: number }
  >()
  for (const tx of allTxns ?? []) {
    const stats = txnStats.get(tx.user_id) ?? { earned: 0, spent: 0 }
    if (tx.amount > 0) stats.earned += tx.amount
    else stats.spent += Math.abs(tx.amount)
    txnStats.set(tx.user_id, stats)
  }

  const sortedBalances = [...(balances ?? [])].sort(
    (a, b) => b.balance - a.balance
  )

  for (let i = 0; i < sortedBalances.length; i++) {
    const b = sortedBalances[i]
    const profile = profileMap.get(b.user_id)
    const linkedPlayer = profile?.player_id
      ? playerMap.get(profile.player_id)
      : null
    const stats = txnStats.get(b.user_id) ?? { earned: 0, spent: 0 }

    await supabase.from("act_snapshots").insert({
      act_id: activeAct.id,
      user_id: b.user_id,
      player_name: linkedPlayer?.name ?? null,
      username: profile?.discord_username ?? "Unknown",
      avatar_url: profile?.discord_avatar_url ?? null,
      final_balance: b.balance,
      total_earned: stats.earned,
      total_spent: stats.spent,
      total_bets: betCountMap.get(b.user_id) ?? 0,
      total_kisses: kissCountMap.get(b.user_id) ?? 0,
      total_shames_received: linkedPlayer
        ? shameCountMap.get(linkedPlayer.id) ?? 0
        : 0,
      total_games: linkedPlayer?.games_played ?? 0,
      wins: linkedPlayer?.wins ?? 0,
      win_rate: linkedPlayer && linkedPlayer.games_played > 0
        ? Number(
            ((linkedPlayer.wins / linkedPlayer.games_played) * 100).toFixed(2)
          )
        : null,
      rank: i + 1,
    })
  }

  if (activeAct.status !== "archived") {
    await supabase
      .from("acts")
      .update({ status: "archived", ended_at: actEnded })
      .eq("id", activeAct.id)
  }

  return NextResponse.json({
    message: `Act ${activeAct.act_number} archived successfully`,
    awards: uniqueAwards,
    snapshots_count: sortedBalances.length,
  })
}
