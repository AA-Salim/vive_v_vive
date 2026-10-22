import { createClient } from "@/lib/supabase"
import { fetchAllRows } from "@/lib/pages/fetch-all"
import { json, scribeError } from "@/lib/pages/server"
import type { ActRef, LeaderboardEntry, LeaderboardResponse } from "@/lib/pages/types"
import { DEVOTION_REASONS } from "@/lib/reasons"

const DAY_MS = 86_400_000
const RECENT_DAYS = 7

interface TxRow {
  user_id: string
  amount: number
  reason: string
  created_at: string
}

// Standard competition ranking: equal balances share a rank (1, 2, 2, 4).
function rankBy(values: { id: string; value: number }[]): Map<string, number> {
  const sorted = [...values].sort((x, y) => y.value - x.value)
  const ranks = new Map<string, number>()
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1]
    ranks.set(entry.id, previous && previous.value === entry.value ? (ranks.get(previous.id) ?? index + 1) : index + 1)
  })
  return ranks
}

export async function GET() {
  const supabase = await createClient()
  const now = Date.now()
  const recentSince = new Date(now - RECENT_DAYS * DAY_MS).toISOString()
  const daySince = now - DAY_MS

  try {
    const [balances, profiles, players, recent, devotion, actResult, authResult] = await Promise.all([
      fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
        supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
      ),
      fetchAllRows<{ id: string; discord_username: string | null; discord_avatar_url: string | null; player_id: string | null }>(
        (from, to) =>
          supabase.from("user_profiles").select("id, discord_username, discord_avatar_url, player_id").order("id").range(from, to)
      ),
      fetchAllRows<{ id: string; name: string; wins: number; losses: number }>((from, to) =>
        supabase.from("players").select("id, name, wins, losses").order("id").range(from, to)
      ),
      fetchAllRows<TxRow>((from, to) =>
        supabase
          .from("point_transactions")
          .select("user_id, amount, reason, created_at")
          .gte("created_at", recentSince)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to)
      ),
      fetchAllRows<{ user_id: string }>((from, to) =>
        supabase
          .from("point_transactions")
          .select("user_id")
          .in("reason", [...DEVOTION_REASONS])
          .order("id")
          .range(from, to)
      ),
      supabase.from("acts").select("id, act_number, name, subtitle, started_at").eq("status", "active").maybeSingle(),
      supabase.auth.getUser(),
    ])

    const profileById = new Map(profiles.map((p) => [p.id, p]))
    const playerById = new Map(players.map((p) => [p.id, p]))
    const viewerId = authResult.data.user?.id ?? null

    const delta24 = new Map<string, number>()
    const last = new Map<string, TxRow>()
    for (const tx of recent) {
      if (!last.has(tx.user_id)) last.set(tx.user_id, tx)
      if (Date.parse(tx.created_at) >= daySince) delta24.set(tx.user_id, (delta24.get(tx.user_id) ?? 0) + tx.amount)
    }
    const devotionCount = new Map<string, number>()
    for (const row of devotion) devotionCount.set(row.user_id, (devotionCount.get(row.user_id) ?? 0) + 1)

    const ranks = rankBy(balances.map((b) => ({ id: b.user_id, value: b.balance })))
    const previousRanks = rankBy(balances.map((b) => ({ id: b.user_id, value: b.balance - (delta24.get(b.user_id) ?? 0) })))

    const leaderboard: LeaderboardEntry[] = balances
      .map((b) => {
        const profile = profileById.get(b.user_id)
        const player = profile?.player_id ? playerById.get(profile.player_id) : undefined
        const lastTx = last.get(b.user_id)
        return {
          rank: ranks.get(b.user_id) ?? 0,
          prev_rank: previousRanks.get(b.user_id) ?? null,
          user_id: b.user_id,
          username: profile?.discord_username ?? "Unknown",
          avatar_url: profile?.discord_avatar_url ?? null,
          player_id: player?.id ?? null,
          player_name: player?.name ?? null,
          balance: b.balance,
          delta_24h: delta24.get(b.user_id) ?? 0,
          last_change: lastTx?.amount ?? null,
          last_reason: lastTx?.reason ?? null,
          last_change_at: lastTx?.created_at ?? null,
          total_kisses: devotionCount.get(b.user_id) ?? 0,
          wins: player?.wins ?? null,
          losses: player?.losses ?? null,
          is_current_user: viewerId === b.user_id,
        }
      })
      .sort((x, y) => x.rank - y.rank || (x.player_name ?? x.username).localeCompare(y.player_name ?? y.username))

    const act = actResult.data
    const actRef: ActRef | null = act
      ? { id: act.id, number: act.act_number, name: act.name, subtitle: act.subtitle ?? null, startedAt: act.started_at }
      : null
    const body: LeaderboardResponse = { leaderboard, act: actRef, generatedAt: new Date(now).toISOString() }
    return json(body)
  } catch {
    return scribeError("The treasury ledger is jammed. Try again in a moment.")
  }
}
