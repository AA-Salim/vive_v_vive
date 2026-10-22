import { createClient } from "@/lib/supabase"
import { fetchAllRows } from "@/lib/pages/fetch-all"
import { loadKissTallies, rankKisses, type Noble } from "@/lib/pages/kiss-board"
import { seasonFromRequest } from "@/lib/pages/season"
import { json, scribeError } from "@/lib/pages/server"
import type { KissBoardResponse } from "@/lib/pages/types"

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
  players: { name: string | null } | { name: string | null }[] | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  try {
    const scope = await seasonFromRequest(supabase, request)
    if ("error" in scope) return scope.error
    const [board, profiles] = await Promise.all([
      loadKissTallies(supabase, scope.window),
      fetchAllRows<ProfileRow>((from, to) =>
        supabase
          .from("user_profiles")
          .select("id, discord_username, discord_avatar_url, player_id, players:player_id ( name )")
          .order("id")
          .range(from, to)
      ),
    ])

    const nobles = new Map<string, Noble>()
    for (const p of profiles) {
      const player = Array.isArray(p.players) ? p.players[0] : p.players
      nobles.set(p.id, {
        name: player?.name || p.discord_username || "A nameless subject",
        avatarUrl: p.discord_avatar_url,
        playerId: p.player_id,
      })
    }

    const entries = rankKisses(board.tallies, nobles)
    const body: KissBoardResponse = {
      available: board.available,
      entries,
      totals: {
        kisses: entries.reduce((sum, e) => sum + e.kisses, 0),
        points: entries.reduce((sum, e) => sum + e.points, 0),
        crowns: entries.reduce((sum, e) => sum + e.crowns, 0),
        legacy: entries.reduce((sum, e) => sum + e.legacy, 0),
        today: entries.filter((e) => e.today).length,
        todayKisses: entries.reduce((sum, e) => sum + e.todayCount, 0),
      },
      today: board.today,
      season: scope.season,
      generatedAt: new Date().toISOString(),
    }
    return json(body)
  } catch {
    return scribeError("The Hall of Kisses is locked. Try again in a moment.")
  }
}
