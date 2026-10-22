import type { SupabaseClient } from "@supabase/supabase-js"
import { ledgerIncome, loadMarketProfits, type LedgerAmount } from "@/lib/income"
import type { MilestoneStat } from "@/lib/milestones"
import { fetchAllRows } from "@/lib/pages/fetch-all"

export type MilestoneStats = Record<MilestoneStat, number>

export const WIN_RATE_MIN_GAMES = 10

// Real income only (lib/income.ts): a refunded or withdrawn stake coming home earns nothing. An unreadable
// ledger counts as nothing earned yet, like the other stats.
async function totalEarned(supabase: SupabaseClient, userId: string): Promise<number> {
  const [credits, profits] = await Promise.all([
    fetchAllRows<LedgerAmount>((from, to) =>
      supabase
        .from("point_transactions")
        .select("user_id, amount, reason")
        .eq("user_id", userId)
        .gt("amount", 0)
        .order("id")
        .range(from, to)
    ),
    loadMarketProfits(supabase, { userId }),
  ]).catch(() => [[], new Map<string, number>()] as const)
  return ledgerIncome(credits) + (profits.get(userId) ?? 0)
}

export async function computeMilestoneStats(supabase: SupabaseClient, userId: string): Promise<MilestoneStats> {
  const { data: profile } = await supabase.from("user_profiles").select("player_id").eq("id", userId).maybeSingle()
  const playerId = (profile?.player_id as string | null | undefined) ?? null

  const count = (query: PromiseLike<{ count: number | null }>) => Promise.resolve(query).then((r) => r.count ?? 0)

  const [player, shames, betsPlaced, betsWon, earned, devotion, chaos, bounties] = await Promise.all([
    playerId
      ? supabase.from("players").select("games_played, wins").eq("id", playerId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    playerId
      ? count(supabase.from("shame_entries").select("id", { count: "exact", head: true }).eq("target_player_id", playerId))
      : Promise.resolve(0),
    count(supabase.from("bets").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("bets").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "won")),
    totalEarned(supabase, userId),
    count(
      supabase
        .from("point_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("reason", ["kiss_the_hand", "sing_his_praises"])
    ),
    count(supabase.from("chaos_actions").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    Promise.all([
      count(supabase.from("bounties").select("id", { count: "exact", head: true }).eq("poster_user_id", userId)),
      count(supabase.from("bounty_pledges").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    ]).then(([legacy, pledges]) => legacy + pledges),
  ])

  const games = (player?.games_played as number | undefined) ?? 0
  const wins = (player?.wins as number | undefined) ?? 0

  return {
    games_played: games,
    wins,
    win_rate: games >= WIN_RATE_MIN_GAMES ? (wins / games) * 100 : 0,
    bets_placed: betsPlaced,
    bets_won: betsWon,
    total_earned: earned,
    devotion_count: devotion,
    shames_received: shames,
    chaos_used: chaos,
    bounties_placed: bounties,
  }
}
