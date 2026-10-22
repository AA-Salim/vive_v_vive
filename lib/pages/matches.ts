import type { SupabaseClient } from "@supabase/supabase-js"
import { ALL_ROLES } from "@/lib/champions"
import { fetchAllRows, uniqueBy } from "@/lib/pages/fetch-all"
import { withinWindow } from "@/lib/pages/season"
import { ALL_TIME, type PlayedWindow } from "@/lib/pages/season-calendar"
import type { PlayerRef } from "@/lib/pages/types"
import type { Role, Side } from "@/lib/types"

export interface MatchSeat {
  playerId: string
  side: Side
  lane: Role
  champion: string
}

export interface Match {
  id: string
  playedAt: string
  winner: Side
  seats: MatchSeat[]
}

export interface MatchData {
  // Oldest first, so streaks can be read in order.
  matches: Match[]
  players: Map<string, PlayerRef>
}

interface GameRow {
  id: string
  played_at: string
  winner_side: string
}

interface SeatRow {
  id: string
  game_id: string
  player_id: string
  side: string
  lane: string
  champion: string
}

const isSide = (value: string): value is Side => value === "blue" || value === "red"
const isRole = (value: string): value is Role => (ALL_ROLES as string[]).includes(value)

export async function loadPlayers(supabase: SupabaseClient): Promise<Map<string, PlayerRef>> {
  const [players, profiles] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("players").select("id, name").order("id").range(from, to)
    ),
    fetchAllRows<{ id: string; discord_avatar_url: string | null; player_id: string | null }>((from, to) =>
      supabase
        .from("user_profiles")
        .select("id, discord_avatar_url, player_id")
        .not("player_id", "is", null)
        .order("id")
        .range(from, to)
    ),
  ])
  const owner = new Map(profiles.filter((p) => p.player_id).map((p) => [p.player_id as string, p]))
  return new Map(
    players.map((p) => {
      const profile = owner.get(p.id)
      return [p.id, { id: p.id, name: p.name, avatarUrl: profile?.discord_avatar_url ?? null, userId: profile?.id ?? null }]
    })
  )
}

const SEAT_COLUMNS = "id, game_id, player_id, side, lane, champion"

// Seats are filtered through their game, so a season only reads its own rows.
export async function loadMatchData(supabase: SupabaseClient, window: PlayedWindow = ALL_TIME): Promise<MatchData> {
  const bounded = window.from !== null || window.to !== null
  const [games, seats, players] = await Promise.all([
    fetchAllRows<GameRow>((from, to) =>
      withinWindow(supabase.from("games").select("id, played_at, winner_side"), window)
        .order("played_at")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<SeatRow>((from, to) =>
      bounded
        ? withinWindow(supabase.from("game_players").select(`${SEAT_COLUMNS}, game:games!inner(played_at)`), window, "game.played_at")
            .order("id")
            .range(from, to)
        : supabase.from("game_players").select(SEAT_COLUMNS).order("id").range(from, to)
    ),
    loadPlayers(supabase),
  ])

  const byGame = new Map<string, MatchSeat[]>()
  for (const seat of uniqueBy(seats, (s) => s.id)) {
    if (!isSide(seat.side) || !isRole(seat.lane) || !players.has(seat.player_id)) continue
    const list = byGame.get(seat.game_id) ?? []
    list.push({ playerId: seat.player_id, side: seat.side, lane: seat.lane, champion: seat.champion })
    byGame.set(seat.game_id, list)
  }

  const matches: Match[] = []
  for (const game of uniqueBy(games, (g) => g.id)) {
    if (!isSide(game.winner_side)) continue
    const list = byGame.get(game.id)
    if (!list || list.length === 0) continue
    matches.push({ id: game.id, playedAt: game.played_at, winner: game.winner_side, seats: list })
  }
  matches.sort((x, y) => Date.parse(x.playedAt) - Date.parse(y.playedAt))
  return { matches, players }
}

export function pairKey(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x]
}
