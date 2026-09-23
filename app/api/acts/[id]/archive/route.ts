import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: act } = await supabase
    .from("acts")
    .select("*")
    .eq("id", Number(id))
    .single()

  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 })
  }

  const { data: awards } = await supabase
    .from("act_awards")
    .select("*")
    .eq("act_id", act.id)
    .order("carry_over_bonus", { ascending: false })

  const { data: snapshots } = await supabase
    .from("act_snapshots")
    .select("*")
    .eq("act_id", act.id)
    .order("rank", { ascending: true })

  // Chart data: daily balance timeline per user
  const { data: transactions } = await supabase
    .from("point_transactions")
    .select("user_id, amount, created_at")
    .gte("created_at", act.started_at)
    .lte("created_at", act.ended_at ?? new Date().toISOString())
    .order("created_at", { ascending: true })

  // Build cumulative balance per user per day
  const userDailyBalance = new Map<string, Map<string, number>>()
  const userRunning = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const day = tx.created_at.split("T")[0]
    const running = (userRunning.get(tx.user_id) ?? 0) + tx.amount
    userRunning.set(tx.user_id, running)

    if (!userDailyBalance.has(tx.user_id)) {
      userDailyBalance.set(tx.user_id, new Map())
    }
    userDailyBalance.get(tx.user_id)!.set(day, running)
  }

  // Flatten into chart-ready format
  const allDays = new Set<string>()
  for (const dailyMap of userDailyBalance.values()) {
    for (const day of dailyMap.keys()) allDays.add(day)
  }
  const sortedDays = [...allDays].sort()

  const snapshotMap = new Map(
    (snapshots ?? []).map((s) => [s.user_id, s.player_name ?? s.username])
  )

  const balanceTimeline = sortedDays.map((day) => {
    const entry: Record<string, string | number> = { date: day }
    for (const [userId, dailyMap] of userDailyBalance) {
      const name = snapshotMap.get(userId) ?? userId.slice(0, 8)
      let lastBalance = 0
      for (const d of sortedDays) {
        if (d > day) break
        if (dailyMap.has(d)) lastBalance = dailyMap.get(d)!
      }
      entry[name] = lastBalance
    }
    return entry
  })

  // Bet outcomes by user
  const { data: bets } = await supabase
    .from("bets")
    .select("user_id, status, amount")
    .gte("created_at", act.started_at)
    .lte("created_at", act.ended_at ?? new Date().toISOString())

  const betOutcomes = new Map<
    string,
    { won: number; lost: number; refunded: number }
  >()
  for (const bet of bets ?? []) {
    const stats = betOutcomes.get(bet.user_id) ?? {
      won: 0,
      lost: 0,
      refunded: 0,
    }
    if (bet.status === "won") stats.won++
    else if (bet.status === "lost") stats.lost++
    else if (bet.status === "refunded") stats.refunded++
    betOutcomes.set(bet.user_id, stats)
  }

  const betOutcomeChart = [...betOutcomes.entries()].map(
    ([userId, stats]) => ({
      name: snapshotMap.get(userId) ?? userId.slice(0, 8),
      ...stats,
    })
  )

  // Economy breakdown (where points went)
  const reasonTotals = new Map<string, number>()
  for (const tx of transactions ?? []) {
    if (tx.amount < 0) {
      const current = reasonTotals.get(tx.user_id + ":" + "spent") ?? 0
      reasonTotals.set(tx.user_id + ":" + "spent", current + Math.abs(tx.amount))
    }
  }

  const spendingByReason = new Map<string, number>()
  for (const tx of transactions ?? []) {
    if (tx.amount < 0) {
      const current = spendingByReason.get(tx.amount < 0 ? tx.created_at : "") ?? 0
      spendingByReason.set(tx.created_at, current)
    }
  }

  // Simpler: aggregate spending by reason
  const reasonSpending = new Map<string, number>()
  for (const tx of transactions ?? []) {
    if (tx.amount < 0) {
      const reason = tx.amount < 0 ? "spent" : "earned"
      // We need reason field - let's use a different approach
    }
  }

  // Fetch transactions with reason for spending breakdown
  const { data: reasonTxns } = await supabase
    .from("point_transactions")
    .select("reason, amount")
    .gte("created_at", act.started_at)
    .lte("created_at", act.ended_at ?? new Date().toISOString())
    .lt("amount", 0)

  const spendingBreakdown: Record<string, number> = {}
  const REASON_LABELS: Record<string, string> = {
    bet_placed: "Bets",
    chaos_spent: "Royal Decrees",
    insurance_bought: "Insurance",
    shame_spent: "Shame",
    sabotage_spent: "Sabotage",
    title_bought: "Titles",
    bounty_placed: "Bounties",
  }
  for (const tx of reasonTxns ?? []) {
    const label = REASON_LABELS[tx.reason] ?? tx.reason
    spendingBreakdown[label] =
      (spendingBreakdown[label] ?? 0) + Math.abs(tx.amount)
  }

  const spendingChart = Object.entries(spendingBreakdown).map(
    ([name, value]) => ({ name, value })
  )

  return NextResponse.json({
    act,
    awards: awards ?? [],
    snapshots: snapshots ?? [],
    charts: {
      balanceTimeline,
      betOutcomes: betOutcomeChart,
      spendingBreakdown: spendingChart,
    },
  })
}
