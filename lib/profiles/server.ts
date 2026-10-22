import { NextResponse } from "next/server"
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { ALL_ROLES } from "@/lib/champions"
import { isMissingSchema } from "@/lib/db-errors"
import { ACT_COLUMNS, type ActRow } from "@/lib/pages/archive"
import { buildChampionIndex } from "@/lib/pages/champion-index"
import { fetchAllRows, uniqueBy } from "@/lib/pages/fetch-all"
import { loadPlayers } from "@/lib/pages/matches"
import { loadPools } from "@/lib/pages/server"
import { ALL_TIME, computeScoped, inWindow, rankOf, recordOf, type OtherSeat, type OwnSeat, type Window } from "@/lib/profiles/compute"
import { readTitles } from "@/lib/profiles/loadout"
import type {
  PlayerProfileResponse,
  ProfileBounty,
  ProfilePraise,
  ProfileRank,
  ProfileSeason,
  ProfileTitles,
  ScopeRequest,
} from "@/lib/profiles/types"
import { buildEquippedTitles } from "@/lib/titles/server"
import type { Role, Side } from "@/lib/types"

export class UnknownActError extends Error {}

interface PlayerRow {
  id: string
  name: string
  is_active: boolean
  auth_user_id: string | null
}

interface LinkRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
}

interface GameJoin {
  played_at: string
  winner_side: string
}

interface OwnSeatRow {
  id: string
  game_id: string
  side: string
  lane: string
  champion: string
  games: GameJoin | GameJoin[] | null
}

interface OtherSeatRow {
  id: string
  game_id: string
  player_id: string
  side: string
  lane: string
  champion: string
}

// 90 games x 9 other seats stays under the 1000-row page cap, and 90 ids keep the URL short.
const GAME_CHUNK = 90
const LINK_COLUMNS = "id, discord_username, discord_avatar_url"

const isSide = (value: string): value is Side => value === "blue" || value === "red"
const isRole = (value: string): value is Role => (ALL_ROLES as string[]).includes(value)

function soft<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error && !isMissingSchema(result.error)) throw result.error
  return result.error ? null : result.data
}

function windowOf(act: ActRow): Window {
  return { from: Date.parse(act.started_at), to: act.ended_at ? Date.parse(act.ended_at) : Infinity }
}

function seasonOf(act: ActRow, seats: OwnSeat[]): ProfileSeason {
  const window = windowOf(act)
  return {
    key: act.act_number,
    number: act.act_number,
    name: act.name,
    subtitle: act.subtitle,
    status: act.status,
    startedAt: act.started_at,
    endedAt: act.ended_at,
    games: seats.filter((s) => inWindow(window, s.playedAt)).length,
  }
}

function allTimeSeason(seats: OwnSeat[]): ProfileSeason {
  return {
    key: "all",
    number: null,
    name: "All time",
    subtitle: null,
    status: null,
    startedAt: seats[0]?.playedAt ?? null,
    endedAt: null,
    games: seats.length,
  }
}

function pickAct(acts: ActRow[], scope: ScopeRequest): ActRow | null {
  if (scope === "all") return null
  if (scope === "current") return acts.find((a) => a.status === "active") ?? null
  const act = acts.find((a) => a.act_number === scope && a.status !== "upcoming")
  if (!act) throw new UnknownActError(`Act ${scope} has not been written yet.`)
  return act
}

function toOwnSeats(rows: OwnSeatRow[]): OwnSeat[] {
  const seats: OwnSeat[] = []
  for (const row of uniqueBy(uniqueBy(rows, (r) => r.id), (r) => r.game_id)) {
    const game = Array.isArray(row.games) ? row.games[0] : row.games
    if (!game || !isSide(game.winner_side) || !isSide(row.side) || !isRole(row.lane)) continue
    seats.push({ gameId: row.game_id, playedAt: game.played_at, winner: game.winner_side, side: row.side, lane: row.lane, champion: row.champion })
  }
  return seats.sort((x, y) => Date.parse(x.playedAt) - Date.parse(y.playedAt))
}

async function loadOtherSeats(supabase: SupabaseClient, playerId: string, gameIds: string[]): Promise<OtherSeat[]> {
  const chunks: string[][] = []
  for (let i = 0; i < gameIds.length; i += GAME_CHUNK) chunks.push(gameIds.slice(i, i + GAME_CHUNK))
  const pages = await Promise.all(
    chunks.map((ids) =>
      fetchAllRows<OtherSeatRow>((from, to) =>
        supabase
          .from("game_players")
          .select("id, game_id, player_id, side, lane, champion")
          .in("game_id", ids)
          .neq("player_id", playerId)
          .order("id")
          .range(from, to)
      )
    )
  )
  return uniqueBy(pages.flat(), (r) => r.id).flatMap((r) =>
    isSide(r.side) && isRole(r.lane) ? [{ gameId: r.game_id, playerId: r.player_id, side: r.side, lane: r.lane, champion: r.champion }] : []
  )
}

async function loadBounty(supabase: SupabaseClient, playerId: string): Promise<ProfileBounty | null> {
  const now = new Date().toISOString()
  const [warrants, legacy] = await Promise.all([
    supabase
      .from("bounty_warrants")
      .select("pledged, crown_bonus, escapes, opened_at, expires_at, bounty_pledges ( status )")
      .eq("target_player_id", playerId)
      .eq("status", "open")
      .gt("expires_at", now)
      .limit(1),
    supabase
      .from("bounties")
      .select("amount, created_at, expires_at")
      .eq("target_player_id", playerId)
      .eq("status", "active")
      .gt("expires_at", now),
  ])
  const warrant = (soft(warrants) ?? [])[0] as
    | { pledged: number; crown_bonus: number; escapes: number; opened_at: string; expires_at: string; bounty_pledges: { status: string }[] | null }
    | undefined
  const posters = (soft(legacy) ?? []) as { amount: number; created_at: string; expires_at: string }[]
  if (!warrant && posters.length === 0) return null

  const opened = [warrant?.opened_at, ...posters.map((p) => p.created_at)].filter((d): d is string => !!d)
  const expiries = [warrant?.expires_at, ...posters.map((p) => p.expires_at)].filter((d): d is string => !!d)
  return {
    price: (warrant ? warrant.pledged + warrant.crown_bonus : 0) + posters.reduce((sum, p) => sum + p.amount, 0),
    backers: (warrant?.bounty_pledges ?? []).filter((p) => p.status === "pledged").length + posters.length,
    escapes: warrant?.escapes ?? 0,
    openedAt: opened.sort()[0],
    expiresAt: expiries.sort()[0],
  }
}

type CountQuery = PromiseLike<{ count: number | null; error: PostgrestError | null }>

// A HEAD count on a missing table answers 204 with no error, so counts read zero rows over GET instead.
async function countOf(query: CountQuery): Promise<number | null> {
  const { count, error } = await query
  if (error && !isMissingSchema(error)) throw error
  return error ? null : (count ?? 0)
}

// Postgres reads "-infinity" and "infinity" as timestamps, so an open window needs no special case.
const isoBound = (at: number) => (Number.isFinite(at) ? new Date(at).toISOString() : at > 0 ? "infinity" : "-infinity")

async function loadPraise(supabase: SupabaseClient, userId: string, window: Window): Promise<ProfilePraise> {
  const from = isoBound(window.from)
  const to = isoBound(window.to)
  const count = (table: string) =>
    supabase.from(table).select("id", { count: "exact" }).eq("user_id", userId).gte("created_at", from).lt("created_at", to).limit(0)

  const [written, crowned, sung, kisses] = await Promise.all([
    countOf(count("praises")),
    countOf(count("praises").eq("verdict", "crowned")),
    countOf(count("point_transactions").eq("reason", "sing_his_praises")),
    countOf(count("point_transactions").eq("reason", "kiss_the_hand")),
  ])
  const songs = written ?? sung ?? 0
  return { total: songs + (kisses ?? 0), songs, kisses: kisses ?? 0, crowned: written === null ? null : crowned }
}

async function loadTitles(supabase: SupabaseClient, userId: string): Promise<ProfileTitles> {
  const [equipped, owned] = await Promise.all([
    buildEquippedTitles(supabase),
    countOf(supabase.from("user_titles").select("id", { count: "exact" }).eq("user_id", userId).limit(0)),
  ])
  const entry = equipped.find((t) => t.userId === userId)
  return readTitles(entry, owned) ?? { source: "single", loadout: [], summary: null, curses: [], owned }
}

async function loadRank(
  supabase: SupabaseClient,
  userId: string,
  act: ActRow | null,
  balances: { user_id: string; balance: number }[]
): Promise<ProfileRank | null> {
  if (act?.status === "archived") {
    const rows = soft(await supabase.from("act_snapshots").select("user_id, final_balance, rank").eq("act_id", act.id)) as
      | { user_id: string; final_balance: number; rank: number | null }[]
      | null
    if (!rows) return null
    const ranked = rankOf(rows.map((r) => ({ user_id: r.user_id, balance: r.final_balance })), userId)
    if (!ranked) return null
    const stored = rows.find((r) => r.user_id === userId)?.rank
    return { ...ranked, rank: stored ?? ranked.rank, source: "archive" }
  }
  const ranked = rankOf(balances, userId)
  return ranked ? { ...ranked, source: "treasury" } : null
}

// Degrade instead of failing the whole file: a sealed side table should not hide a player's record.
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch {
    return null
  }
}

export async function loadPlayerProfile(
  supabase: SupabaseClient,
  playerId: string,
  scope: ScopeRequest
): Promise<PlayerProfileResponse | null> {
  const [playerRes, linkRes, actsRes, ownRows, roster, pools, balances, bounty] = await Promise.all([
    supabase.from("players").select("id, name, is_active, auth_user_id").eq("id", playerId).maybeSingle(),
    supabase.from("user_profiles").select(LINK_COLUMNS).eq("player_id", playerId).limit(1),
    supabase.from("acts").select(ACT_COLUMNS).order("act_number", { ascending: true }),
    fetchAllRows<OwnSeatRow>((from, to) =>
      supabase
        .from("game_players")
        .select("id, game_id, side, lane, champion, games!inner ( played_at, winner_side )")
        .eq("player_id", playerId)
        .order("id")
        .range(from, to)
    ),
    loadPlayers(supabase),
    loadPools().catch(() => null),
    fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
      supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
    ),
    optional(() => loadBounty(supabase, playerId)),
  ])
  if (playerRes.error) throw playerRes.error
  const player = playerRes.data as PlayerRow | null
  if (!player) return null
  if (actsRes.error && !isMissingSchema(actsRes.error)) throw actsRes.error

  const acts = ((actsRes.data ?? []) as ActRow[]).filter((a) => a.status !== "upcoming")
  const act = pickAct(acts, scope)
  const window = act ? windowOf(act) : ALL_TIME
  const seats = toOwnSeats(ownRows)
  const scoped = seats.filter((s) => inWindow(window, s.playedAt))

  let link = ((linkRes.data ?? []) as LinkRow[])[0] ?? null
  if (player.auth_user_id && link?.id !== player.auth_user_id) {
    const { data } = await supabase.from("user_profiles").select(LINK_COLUMNS).eq("id", player.auth_user_id).maybeSingle()
    link = (data as LinkRow | null) ?? link
  }
  const userId = player.auth_user_id ?? link?.id ?? null

  const [others, titles, praise, rank] = await Promise.all([
    loadOtherSeats(supabase, playerId, scoped.map((s) => s.gameId)),
    userId ? optional(() => loadTitles(supabase, userId)) : null,
    userId ? optional(() => loadPraise(supabase, userId, window)) : null,
    userId ? optional(() => loadRank(supabase, userId, act, balances)) : null,
  ])

  const internalOf = buildChampionIndex(pools)
  const stats = computeScoped(scoped, others, roster, internalOf)
  const seasons = [...acts.map((a) => seasonOf(a, seats)).reverse(), allTimeSeason(seats)]

  return {
    player: {
      id: player.id,
      name: player.name,
      isActive: player.is_active,
      userId,
      username: link?.discord_username ?? null,
      avatarUrl: link?.discord_avatar_url ?? roster.get(player.id)?.avatarUrl ?? null,
    },
    scope: act ? seasonOf(act, seats) : allTimeSeason(seats),
    seasons,
    record: stats.record,
    allTime: recordOf(seats),
    form: stats.form,
    streak: stats.streak,
    bestWinStreak: stats.bestWinStreak,
    lastPlayedAt: stats.lastPlayedAt,
    rank,
    lanes: stats.lanes,
    champions: stats.champions,
    uniqueChampions: stats.uniqueChampions,
    recent: stats.recent,
    rivals: stats.rivals,
    titles,
    praise,
    bounty,
    generatedAt: new Date().toISOString(),
  }
}

export async function findPlayerIdByName(supabase: SupabaseClient, name: string): Promise<string | null> {
  const wanted = name.trim().toLocaleLowerCase()
  const players = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    supabase.from("players").select("id, name").order("id").range(from, to)
  )
  return players.find((p) => p.name.trim().toLocaleLowerCase() === wanted)?.id ?? null
}

export function profileError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })
}

// Public and read-only, so a shared edge copy is fine; ten seconds keeps post-game refetches honest.
export function profileJson(body: PlayerProfileResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" },
  })
}
