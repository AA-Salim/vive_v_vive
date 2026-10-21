import type { SupabaseClient } from "@supabase/supabase-js"
import type { MilestoneStat } from "@/lib/milestones"

export type MilestoneStats = Record<MilestoneStat, number>

const WIN_RATE_MIN_GAMES = 10

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
    supabase
      .from("point_transactions")
      .select("amount")
      .eq("user_id", userId)
      .gt("amount", 0)
      .then((r) => (r.data ?? []).reduce((sum, t) => sum + (t.amount as number), 0)),
    count(
      supabase
        .from("point_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("reason", ["kiss_the_hand", "sing_his_praises"])
    ),
    count(supabase.from("chaos_actions").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("bounties").select("id", { count: "exact", head: true }).eq("poster_user_id", userId)),
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
