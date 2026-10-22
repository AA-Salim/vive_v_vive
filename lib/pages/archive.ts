import type { SupabaseClient } from "@supabase/supabase-js"
import { loadMarketProfits, summarizeEarnings } from "@/lib/income"
import { fetchAllRows } from "@/lib/pages/fetch-all"
import { loadMatchData } from "@/lib/pages/matches"
import { winRate } from "@/lib/pages/compute-players"
import type { ArchiveAward, ArchiveDetailResponse, ArchiveStanding, ArchiveTimeline } from "@/lib/pages/types"
import { isDevotion, reasonMeta, REASON_GROUPS, type ReasonGroup } from "@/lib/reasons"
import type { ActStatus } from "@/lib/types"

const DAY_MS = 86_400_000
const DECREE_REASONS = new Set(["chaos_spent", "sabotage_spent"])

export interface ActRow {
  id: number
  act_number: number
  name: string
  subtitle: string | null
  status: ActStatus
  started_at: string
  ended_at: string | null
}

export interface SnapshotRow {
  act_id: number
  user_id: string
  player_name: string | null
  username: string | null
  avatar_url: string | null
  final_balance: number
  total_earned: number
  total_spent: number
  total_bets: number
  total_kisses: number
  total_shames_received: number
  total_games: number
  wins: number
  win_rate: number | null
  rank: number | null
}

interface AwardRow {
  id: string
  user_id: string
  category: string
  title: string
  carry_over_bonus: number
  final_value: string | null
}

interface TxRow {
  user_id: string
  amount: number
  reason: string
  created_at: string
}

interface BetRow {
  user_id: string
  status: string
  amount: number
}

export const ACT_COLUMNS = "id, act_number, name, subtitle, status, started_at, ended_at"
export const SNAPSHOT_COLUMNS =
  "act_id, user_id, player_name, username, avatar_url, final_balance, total_earned, total_spent, total_bets, total_kisses, total_shames_received, total_games, wins, win_rate, rank"

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function buildTimeline(standings: ArchiveStanding[], txs: TxRow[], startMs: number, endMs: number): ArchiveTimeline {
  const days: string[] = []
  for (let t = Date.parse(`${dayKey(startMs)}T00:00:00Z`); t <= endMs; t += DAY_MS) days.push(dayKey(t))
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  const net = new Map<string, number[]>()
  for (const tx of txs) {
    const index = dayIndex.get(tx.created_at.slice(0, 10))
    if (index === undefined) continue
    const list = net.get(tx.user_id) ?? new Array<number>(days.length).fill(0)
    list[index] += tx.amount
    net.set(tx.user_id, list)
  }

  const series = standings.map((s) => {
    const perDay = net.get(s.userId) ?? new Array<number>(days.length).fill(0)
    const values = new Array<number>(days.length)
    let balance = s.balance
    for (let i = days.length - 1; i >= 0; i--) {
      values[i] = balance
      balance -= perDay[i]
    }
    return { userId: s.userId, name: s.name, values }
  })
  return { days, series }
}

function fromSnapshot(s: SnapshotRow): ArchiveStanding {
  return {
    userId: s.user_id,
    rank: s.rank ?? 0,
    name: s.player_name || s.username || "A nameless noble",
    username: s.username,
    avatarUrl: s.avatar_url,
    balance: s.final_balance,
    earned: s.total_earned,
    spent: s.total_spent,
    bets: s.total_bets,
    devotion: s.total_kisses,
    games: s.total_games,
    wins: s.wins,
    winRate: s.win_rate,
    shames: s.total_shames_received,
  }
}

// The act still running has no snapshot yet: its standings are rebuilt from live balances and the act's ledger.
async function liveStandings(
  supabase: SupabaseClient,
  txs: TxRow[],
  bets: BetRow[],
  startMs: number,
  endMs: number
): Promise<ArchiveStanding[]> {
  const [balances, profiles, matchData, profits] = await Promise.all([
    fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
      supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
    ),
    fetchAllRows<{ id: string; discord_username: string | null; discord_avatar_url: string | null; player_id: string | null }>(
      (from, to) => supabase.from("user_profiles").select("id, discord_username, discord_avatar_url, player_id").order("id").range(from, to)
    ),
    loadMatchData(supabase),
    loadMarketProfits(supabase, { since: new Date(startMs).toISOString(), until: new Date(endMs).toISOString() }),
  ])
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const record = new Map<string, { games: number; wins: number }>()
  for (const match of matchData.matches) {
    const at = Date.parse(match.playedAt)
    if (at < startMs || at > endMs) continue
    for (const seat of match.seats) {
      const tally = record.get(seat.playerId) ?? { games: 0, wins: 0 }
      tally.games++
      if (seat.side === match.winner) tally.wins++
      record.set(seat.playerId, tally)
    }
  }

  // Same earned / spent as the snapshot written when the act is archived (app/api/admin/archive-act).
  const earnings = summarizeEarnings(txs, profits)
  const devotion = new Map<string, number>()
  for (const tx of txs) {
    if (isDevotion(tx.reason)) devotion.set(tx.user_id, (devotion.get(tx.user_id) ?? 0) + 1)
  }
  const betCount = new Map<string, number>()
  for (const bet of bets) betCount.set(bet.user_id, (betCount.get(bet.user_id) ?? 0) + 1)

  const sorted = [...balances].sort((x, y) => y.balance - x.balance)
  return sorted.map((b, index) => {
    const profile = profileById.get(b.user_id)
    const player = profile?.player_id ? matchData.players.get(profile.player_id) : undefined
    const games = player ? record.get(player.id) : undefined
    const sum = earnings.get(b.user_id)
    return {
      userId: b.user_id,
      rank: index + 1,
      name: player?.name || profile?.discord_username || "A nameless noble",
      username: profile?.discord_username ?? null,
      avatarUrl: profile?.discord_avatar_url ?? null,
      balance: b.balance,
      earned: sum?.earned ?? 0,
      spent: sum?.spent ?? 0,
      bets: betCount.get(b.user_id) ?? 0,
      devotion: devotion.get(b.user_id) ?? 0,
      games: games?.games ?? 0,
      wins: games?.wins ?? 0,
      winRate: games && games.games > 0 ? winRate(games.wins, games.games) : null,
      shames: 0,
    }
  })
}

export async function buildArchiveDetail(supabase: SupabaseClient, act: ActRow): Promise<ArchiveDetailResponse> {
  const startMs = Date.parse(act.started_at)
  const endIso = act.ended_at ?? new Date().toISOString()
  const endMs = Date.parse(endIso)

  const [awardsResult, snapshots, txs, bets, gamesResult] = await Promise.all([
    supabase.from("act_awards").select("id, user_id, category, title, carry_over_bonus, final_value").eq("act_id", act.id),
    fetchAllRows<SnapshotRow>((from, to) =>
      supabase.from("act_snapshots").select(SNAPSHOT_COLUMNS).eq("act_id", act.id).order("user_id").range(from, to)
    ),
    fetchAllRows<TxRow>((from, to) =>
      supabase
        .from("point_transactions")
        .select("user_id, amount, reason, created_at")
        .gte("created_at", act.started_at)
        .lte("created_at", endIso)
        .order("created_at", { ascending: true })
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<BetRow>((from, to) =>
      supabase
        .from("bets")
        .select("user_id, status, amount")
        .gte("created_at", act.started_at)
        .lte("created_at", endIso)
        .order("id")
        .range(from, to)
    ),
    supabase.from("games").select("id", { count: "exact", head: true }).gte("played_at", act.started_at).lte("played_at", endIso),
  ])

  const standings =
    snapshots.length > 0
      ? snapshots.map(fromSnapshot).sort((x, y) => (x.rank || Infinity) - (y.rank || Infinity) || y.balance - x.balance)
      : await liveStandings(supabase, txs, bets, startMs, endMs)
  const byUser = new Map(standings.map((s) => [s.userId, s]))

  const awards: ArchiveAward[] = ((awardsResult.data ?? []) as AwardRow[])
    .map((a) => {
      const holder = byUser.get(a.user_id)
      return {
        id: a.id,
        category: a.category,
        title: a.title,
        userId: a.user_id,
        name: holder?.name ?? "A nameless noble",
        avatarUrl: holder?.avatarUrl ?? null,
        value: a.final_value,
        bonus: a.carry_over_bonus,
      }
    })
    .sort((x, y) => y.bonus - x.bonus)

  const outcomes = new Map<string, { won: number; lost: number; refunded: number }>()
  let wagered = 0
  for (const bet of bets) {
    const entry = outcomes.get(bet.user_id) ?? { won: 0, lost: 0, refunded: 0 }
    if (bet.status === "won") entry.won++
    else if (bet.status === "lost") entry.lost++
    else if (bet.status === "refunded") entry.refunded++
    if (bet.status !== "refunded") wagered += Number(bet.amount) || 0
    outcomes.set(bet.user_id, entry)
  }

  const spendingByGroup = new Map<ReasonGroup, number>()
  let decrees = 0
  let devotion = 0
  for (const tx of txs) {
    if (DECREE_REASONS.has(tx.reason)) decrees++
    if (isDevotion(tx.reason)) devotion++
    if (tx.amount >= 0) continue
    const group = reasonMeta(tx.reason).group
    spendingByGroup.set(group, (spendingByGroup.get(group) ?? 0) - tx.amount)
  }

  return {
    act: {
      id: act.id,
      number: act.act_number,
      name: act.name,
      subtitle: act.subtitle,
      startedAt: act.started_at,
      status: act.status,
      endedAt: act.ended_at,
    },
    awards,
    standings,
    timeline: buildTimeline(standings, txs, startMs, endMs),
    totals: {
      games: gamesResult.count ?? 0,
      bets: bets.length,
      wagered,
      decrees,
      devotion,
      transactions: txs.length,
    },
    bets: [...outcomes.entries()]
      .map(([userId, o]) => ({ userId, name: byUser.get(userId)?.name ?? "A nameless noble", ...o }))
      .sort((x, y) => y.won + y.lost - (x.won + x.lost) || y.won - x.won),
    spending: [...spendingByGroup.entries()]
      .map(([group, total]) => ({ group, label: REASON_GROUPS[group].label, total }))
      .sort((x, y) => y.total - x.total),
  }
}
