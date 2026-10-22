import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { fetchAllRows, uniqueBy } from "@/lib/pages/fetch-all"
import { currentSeason, loadSeasons, SeasonParam, windowOf, withinWindow, type PlayedWindow } from "@/lib/pages/season"
import { json, scribeError } from "@/lib/pages/server"
import type { ActRef, LeaderboardEntry, LeaderboardResponse, Season } from "@/lib/pages/types"
import { DEVOTION_REASONS } from "@/lib/reasons"

const DAY_MS = 86_400_000
const RECENT_DAYS = 7

interface SeatRow {
  id: string
  player_id: string
  side: string
  // A many-to-one embed arrives as one object; untyped clients declare it as a list.
  game: { winner_side: string } | { winner_side: string }[] | null
}

interface TxRow {
  user_id: string
  amount: number
  reason: string
  created_at: string
}

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
}

interface SnapshotRow {
  user_id: string
  player_name: string | null
  username: string | null
  avatar_url: string | null
  final_balance: number
  total_kisses: number
  rank: number | null
}

type Tallies = Map<string, { wins: number; losses: number }>

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

// Balances restart every act, so the records next to them count the same act's games only.
async function loadRecords(supabase: SupabaseClient, window: PlayedWindow): Promise<Tallies> {
  const seats = await fetchAllRows<SeatRow>((from, to) =>
    withinWindow(supabase.from("game_players").select("id, player_id, side, game:games!inner(played_at, winner_side)"), window, "game.played_at")
      .order("id")
      .range(from, to)
  )
  const record: Tallies = new Map()
  for (const seat of uniqueBy(seats, (s) => s.id)) {
    const game = Array.isArray(seat.game) ? seat.game[0] : seat.game
    if (!game) continue
    const tally = record.get(seat.player_id) ?? { wins: 0, losses: 0 }
    if (seat.side === game.winner_side) tally.wins++
    else tally.losses++
    record.set(seat.player_id, tally)
  }
  return record
}

const loadProfiles = (supabase: SupabaseClient) =>
  fetchAllRows<ProfileRow>((from, to) =>
    supabase.from("user_profiles").select("id, discord_username, discord_avatar_url, player_id").order("id").range(from, to)
  )

const loadPlayerNames = (supabase: SupabaseClient) =>
  fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from("players").select("id, name").order("id").range(from, to))

const byRankThenName = (x: LeaderboardEntry, y: LeaderboardEntry) =>
  x.rank - y.rank || (x.player_name ?? x.username).localeCompare(y.player_name ?? y.username)

const actRefOf = (season: Season): ActRef => ({
  id: season.id,
  number: season.number,
  name: season.name,
  subtitle: season.name,
  startedAt: season.startedAt,
})

async function liveBoard(supabase: SupabaseClient, season: Season | null): Promise<LeaderboardResponse> {
  const now = Date.now()
  const recentSince = new Date(now - RECENT_DAYS * DAY_MS).toISOString()
  const daySince = now - DAY_MS

  const [balances, profiles, players, recent, devotion, authResult, record] = await Promise.all([
    fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
      supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
    ),
    loadProfiles(supabase),
    loadPlayerNames(supabase),
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
      withinWindow(supabase.from("point_transactions").select("user_id").in("reason", [...DEVOTION_REASONS]), windowOf(season), "created_at")
        .order("id")
        .range(from, to)
    ),
    supabase.auth.getUser(),
    loadRecords(supabase, windowOf(season)),
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
        wins: player ? (record.get(player.id)?.wins ?? 0) : null,
        losses: player ? (record.get(player.id)?.losses ?? 0) : null,
        is_current_user: viewerId === b.user_id,
      }
    })
    .sort(byRankThenName)

  return { leaderboard, act: season ? actRefOf(season) : null, generatedAt: new Date(now).toISOString(), season, sealed: false }
}

// A closed act: the standings sealed in its snapshots. Records are recounted from the act's games, so they match
// the stats pages even after duplicate games were cleaned up.
async function sealedBoard(supabase: SupabaseClient, season: Season): Promise<LeaderboardResponse> {
  const [snapshots, profiles, players, authResult, record] = await Promise.all([
    fetchAllRows<SnapshotRow>((from, to) =>
      supabase
        .from("act_snapshots")
        .select("user_id, player_name, username, avatar_url, final_balance, total_kisses, rank")
        .eq("act_id", season.id)
        .order("user_id")
        .range(from, to)
    ),
    loadProfiles(supabase),
    loadPlayerNames(supabase),
    supabase.auth.getUser(),
    loadRecords(supabase, windowOf(season)),
  ])

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const playerById = new Map(players.map((p) => [p.id, p]))
  const viewerId = authResult.data.user?.id ?? null
  const fallbackRanks = rankBy(snapshots.map((s) => ({ id: s.user_id, value: s.final_balance })))

  const leaderboard: LeaderboardEntry[] = snapshots
    .map((s) => {
      const profile = profileById.get(s.user_id)
      const player = profile?.player_id ? playerById.get(profile.player_id) : undefined
      return {
        rank: s.rank ?? fallbackRanks.get(s.user_id) ?? 0,
        prev_rank: null,
        user_id: s.user_id,
        username: s.username ?? profile?.discord_username ?? "Unknown",
        avatar_url: s.avatar_url ?? profile?.discord_avatar_url ?? null,
        player_id: player?.id ?? null,
        player_name: s.player_name ?? player?.name ?? null,
        balance: s.final_balance,
        delta_24h: 0,
        last_change: null,
        last_reason: null,
        last_change_at: null,
        total_kisses: s.total_kisses,
        wins: player ? (record.get(player.id)?.wins ?? 0) : null,
        losses: player ? (record.get(player.id)?.losses ?? 0) : null,
        is_current_user: viewerId === s.user_id,
      }
    })
    .sort(byRankThenName)

  return { leaderboard, act: actRefOf(season), generatedAt: new Date().toISOString(), season, sealed: true }
}

export async function GET(request: Request) {
  const parsed = SeasonParam.safeParse(new URL(request.url).searchParams.get("act") || undefined)
  if (!parsed.success) return scribeError("That season is not in the royal calendar.", 400)

  const supabase = await createClient()
  try {
    const seasons = await loadSeasons(supabase)
    const choice = parsed.data
    // There is no all-time treasury: "all" reads the act being played, like no choice at all.
    const season =
      typeof choice === "number" ? seasons.find((s) => s.number === choice && s.status !== "upcoming") : currentSeason(seasons)
    if (season === undefined) return scribeError("That act has not been written yet.", 404)
    return json(season && season.status !== "active" ? await sealedBoard(supabase, season) : await liveBoard(supabase, season))
  } catch {
    return scribeError("The treasury ledger is jammed. Try again in a moment.")
  }
}
