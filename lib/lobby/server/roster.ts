import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { FORM_LENGTH, HISTORY_GAMES, RECENT_WINDOW_DAYS } from "@/lib/lobby/constants"
import type { GameResult, RosterPlayer } from "@/lib/lobby/types"
import type { Side } from "@/lib/types"

interface PlayerRow {
  id: string
  name: string
  is_active: boolean
  is_admin: boolean | null
  wins: number
  losses: number
  games_played: number
  created_at: string
  auth_user_id: string | null
}

interface GameRow {
  id: string
  played_at: string
  winner_side: Side
}

interface GamePlayerRow {
  game_id: string
  player_id: string
  side: Side
}

interface Activity {
  recent: number
  last: string | null
  form: GameResult[]
}

export const PLAYER_COLUMNS = "id, name, is_active, is_admin, wins, losses, games_played, created_at, auth_user_id"

export function toRosterPlayer(row: PlayerRow, activity?: Activity): RosterPlayer {
  return {
    id: row.id,
    name: row.name,
    is_active: row.is_active,
    is_admin: !!row.is_admin,
    wins: row.wins,
    losses: row.losses,
    games_played: row.games_played,
    created_at: row.created_at,
    auth_user_id: row.auth_user_id,
    recent_games: activity?.recent ?? 0,
    last_played_at: activity?.last ?? null,
    form: activity?.form ?? [],
  }
}

// Recent activity from the last HISTORY_GAMES games: drives "most active first" and the form strip.
async function loadActivity(supabase: SupabaseClient): Promise<Map<string, Activity>> {
  const activity = new Map<string, Activity>()
  const { data: games } = await supabase
    .from("games")
    .select("id, played_at, winner_side")
    .order("played_at", { ascending: false })
    .limit(HISTORY_GAMES)
  const list = (games ?? []) as GameRow[]
  if (list.length === 0) return activity

  const { data: rows } = await supabase
    .from("game_players")
    .select("game_id, player_id, side")
    .in(
      "game_id",
      list.map((g) => g.id)
    )
    .limit(HISTORY_GAMES * 10)
  const byGame = new Map(list.map((g, index) => [g.id, { ...g, index }]))
  const since = Date.now() - RECENT_WINDOW_DAYS * 86_400_000

  const seats = ((rows ?? []) as GamePlayerRow[])
    .flatMap((row) => {
      const game = byGame.get(row.game_id)
      return game ? [{ row, game }] : []
    })
    .sort((a, b) => a.game.index - b.game.index)

  for (const { row, game } of seats) {
    const entry = activity.get(row.player_id) ?? { recent: 0, last: null, form: [] }
    if (Date.parse(game.played_at) >= since) entry.recent += 1
    entry.last ??= game.played_at
    if (entry.form.length < FORM_LENGTH) entry.form.push(game.winner_side === row.side ? "W" : "L")
    activity.set(row.player_id, entry)
  }
  return activity
}

export async function loadRoster(supabase: SupabaseClient): Promise<{ players: RosterPlayer[]; error: string | null }> {
  const [{ data, error }, activity] = await Promise.all([
    supabase.from("players").select(PLAYER_COLUMNS).order("name"),
    loadActivity(supabase).catch(() => new Map<string, Activity>()),
  ])
  if (error) return { players: [], error: error.message }
  return { players: ((data ?? []) as PlayerRow[]).map((row) => toRosterPlayer(row, activity.get(row.id))), error: null }
}

// Compared here rather than with ilike: PostgREST reads "*" in a pattern as a wildcard.
export async function findPlayerByName(supabase: SupabaseClient, name: string, exceptId?: string): Promise<boolean> {
  const { data } = await supabase.from("players").select("id, name")
  const wanted = name.trim().toLocaleLowerCase()
  return ((data ?? []) as { id: string; name: string }[]).some((p) => p.id !== exceptId && p.name.trim().toLocaleLowerCase() === wanted)
}

// Every row that points at a player. Deleting would cascade into (or be blocked by) these: open bounties
// would vanish with their escrow, so any reference at all means "bench instead".
const PLAYER_REFERENCES: readonly [table: string, column: string][] = [
  ["game_players", "player_id"],
  ["session_assignments", "player_id"],
  ["coach_draft_picks", "player_id"],
  ["bounties", "target_player_id"],
  ["shame_entries", "target_player_id"],
  ["chaos_actions", "target_player_id"],
  ["chaos_actions", "target_player_2_id"],
  ["act_awards", "player_id"],
  ["prophecy_wagers", "player_id"],
  ["post_game_ballots", "player_id"],
  ["user_profiles", "player_id"],
]

export async function playerHasHistory(supabase: SupabaseClient, playerId: string): Promise<{ history: boolean; error: boolean }> {
  const results = await Promise.all(
    PLAYER_REFERENCES.map(([table, column]) => supabase.from(table).select("*", { count: "exact", head: true }).eq(column, playerId))
  )
  let error = false
  let history = false
  for (const { count, error: queryError } of results) {
    if (queryError) {
      if (!isMissingSchema(queryError)) error = true
      continue
    }
    if ((count ?? 0) > 0) history = true
  }
  return { history, error }
}
