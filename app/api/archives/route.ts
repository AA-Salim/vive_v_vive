import { createClient } from "@/lib/supabase"
import { ACT_COLUMNS, type ActRow } from "@/lib/pages/archive"
import { fetchAllRows } from "@/lib/pages/fetch-all"
import { json, scribeError } from "@/lib/pages/server"
import type { ArchiveSummary, ArchivesResponse } from "@/lib/pages/types"

interface SnapshotLite {
  act_id: number
  user_id: string
  player_name: string | null
  username: string | null
  avatar_url: string | null
  final_balance: number
  rank: number | null
}

export async function GET() {
  const supabase = await createClient()
  try {
    const [actsResult, snapshots, games, balances, profiles] = await Promise.all([
      supabase.from("acts").select(ACT_COLUMNS).order("act_number", { ascending: true }),
      fetchAllRows<SnapshotLite>((from, to) =>
        supabase
          .from("act_snapshots")
          .select("act_id, user_id, player_name, username, avatar_url, final_balance, rank")
          .order("id")
          .range(from, to)
      ),
      fetchAllRows<{ played_at: string }>((from, to) => supabase.from("games").select("played_at").order("id").range(from, to)),
      fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
        supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
      ),
      fetchAllRows<{ id: string; discord_username: string | null; discord_avatar_url: string | null; players: unknown }>(
        (from, to) =>
          supabase.from("user_profiles").select("id, discord_username, discord_avatar_url, players:player_id ( name )").order("id").range(from, to)
      ),
    ])
    if (actsResult.error) return scribeError()

    const playedAt = games.map((g) => Date.parse(g.played_at))
    const profileById = new Map(profiles.map((p) => [p.id, p]))
    const leader = [...balances].sort((x, y) => y.balance - x.balance)[0]

    const acts: ArchiveSummary[] = ((actsResult.data ?? []) as ActRow[]).map((act) => {
      const start = Date.parse(act.started_at)
      const end = act.ended_at ? Date.parse(act.ended_at) : Infinity
      const own = snapshots.filter((s) => s.act_id === act.id)
      let champion: ArchiveSummary["champion"] = null
      if (own.length > 0) {
        const top = [...own].sort((x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity) || y.final_balance - x.final_balance)[0]
        champion = { name: top.player_name || top.username || "A nameless noble", avatarUrl: top.avatar_url, balance: top.final_balance }
      } else if (act.status === "active" && leader) {
        const profile = profileById.get(leader.user_id)
        const joined = profile?.players as { name?: string } | { name?: string }[] | null | undefined
        const playerName = Array.isArray(joined) ? joined[0]?.name : joined?.name
        champion = {
          name: playerName || profile?.discord_username || "A nameless noble",
          avatarUrl: profile?.discord_avatar_url ?? null,
          balance: leader.balance,
        }
      }
      return {
        id: act.id,
        number: act.act_number,
        name: act.name,
        subtitle: act.subtitle,
        status: act.status,
        startedAt: act.started_at,
        endedAt: act.ended_at,
        champion,
        participants: own.length > 0 ? own.length : act.status === "active" ? balances.length : 0,
        games: playedAt.filter((t) => t >= start && t <= end).length,
      }
    })

    const body: ArchivesResponse = { acts }
    return json(body)
  } catch {
    return scribeError()
  }
}
