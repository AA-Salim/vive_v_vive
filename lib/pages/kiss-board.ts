import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { fetchAllRows, QueryError, uniqueBy } from "@/lib/pages/fetch-all"
import { inWindow, type PlayedWindow } from "@/lib/pages/season-calendar"
import { withinWindow } from "@/lib/pages/season"
import type { KissEntry, KissPraise } from "@/lib/pages/types"

export const RECENT_PRAISES = 5

// What one subject's praises earned in a window, before names and ranks are attached.
export interface KissTally {
  userId: string
  kisses: number
  reward: number
  riddle: number
  favor: number
  crowns: number
  scorns: number
  legacy: number
  today: boolean
  todayCount: number
  avgRiddleMs: number | null
  riddleMisses: number
  lastAt: string | null
  recent: KissPraise[]
}

export interface KissTallies {
  available: boolean
  today: string
  tallies: KissTally[]
}

interface RpcPraise {
  id: string
  body: string
  created_at: string
  praise_day: string
  verdict: KissPraise["verdict"]
  verdict_note: string | null
  reward: number
  riddle: number
  favor: number
  riddle_ms?: number | null
  riddle_misses?: number | null
}

interface RpcPlayer {
  user_id: string
  kisses: number
  reward: number
  riddle: number
  favor: number
  crowns: number
  scorns: number
  legacy: number
  today: boolean
  // Missing before the daily kiss slots and riddle clock versions of phase10_praise-board.sql.
  today_count?: number
  avg_riddle_ms?: number | null
  riddle_misses?: number
  last_at: string | null
  recent: RpcPraise[]
}

interface PraiseRow {
  id: string
  user_id: string
  body: string
  reward: number
  favor: number
  verdict: KissPraise["verdict"]
  verdict_note: string | null
  praise_day: string
  created_at: string
  riddle_ms?: number | null
  riddle_misses?: number | null
}

interface LedgerRow {
  id: string
  user_id: string
  amount: number
  reason: string
  reference_id: string | null
  created_at: string
}

type PraiseFields = Pick<PraiseRow, "id" | "body" | "created_at" | "praise_day" | "verdict" | "verdict_note" | "riddle_ms" | "riddle_misses">

const toPraise = (row: PraiseFields, favor: number, points: number): KissPraise => ({
  id: row.id,
  body: row.body,
  createdAt: row.created_at,
  praiseDay: row.praise_day,
  verdict: row.verdict,
  verdictNote: row.verdict_note,
  favor,
  points,
  riddleMs: row.riddle_ms ?? null,
  riddleMisses: row.riddle_misses ?? null,
})

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null

const utcDay = () => new Date().toISOString().slice(0, 10)

// The migrated path: phase10_praise-board.sql sums the ledger rows tied to each praise in one call.
function fromRpc(data: { today?: string; players?: RpcPlayer[] } | null): KissTallies {
  const today = data?.today ?? utcDay()
  return {
    available: true,
    today,
    tallies: (data?.players ?? []).map((p) => ({
      userId: p.user_id,
      kisses: Number(p.kisses),
      reward: Number(p.reward),
      riddle: Number(p.riddle),
      favor: Number(p.favor),
      crowns: Number(p.crowns),
      scorns: Number(p.scorns),
      legacy: Number(p.legacy),
      today: p.today,
      todayCount: p.today_count != null ? Number(p.today_count) : (p.recent ?? []).filter((r) => r.praise_day === today).length,
      avgRiddleMs: p.avg_riddle_ms != null ? Number(p.avg_riddle_ms) : null,
      riddleMisses: Number(p.riddle_misses ?? 0),
      lastAt: p.last_at,
      recent: (p.recent ?? []).map((r) => toPraise(r, Number(r.favor), Number(r.reward) + Number(r.riddle) + Number(r.favor))),
    })),
  }
}

const PRAISE_FIELDS = "id, user_id, body, reward, favor, verdict, verdict_note, praise_day, created_at"


function fetchPraises(supabase: SupabaseClient, window: PlayedWindow, fields: string) {
  return fetchAllRows<PraiseRow>((from, to) =>
    withinWindow(supabase.from("praises").select(fields), window, "created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
      .overrideTypes<PraiseRow[], { merge: false }>()
  )
}

// Before the migration: the praise row keeps what its reward and crown paid, the ledger adds the riddle bonus and
// the Act I kisses. Ledger rows tied to a praise can land after the window closed (a late crown), so only the legacy
// rows are bounded on both sides. The riddle time and misses columns come with the riddle clock: read without
// them until it runs.
async function fromTables(supabase: SupabaseClient, window: PlayedWindow): Promise<KissTallies> {
  let praises: PraiseRow[]
  try {
    praises = await fetchPraises(supabase, window, `${PRAISE_FIELDS}, riddle_ms, riddle_misses`).catch((error) => {
      if (error instanceof QueryError && isMissingSchema(error.cause)) return fetchPraises(supabase, window, PRAISE_FIELDS)
      throw error
    })
  } catch (error) {
    if (error instanceof QueryError && isMissingSchema(error.cause)) return { available: false, today: utcDay(), tallies: [] }
    throw error
  }

  const rows = uniqueBy(
    await fetchAllRows<LedgerRow>((from, to) =>
      withinWindow(
        supabase
          .from("point_transactions")
          .select("id, user_id, amount, reason, reference_id, created_at")
          .in("reason", ["riddle_bonus", "kiss_the_hand", "sing_his_praises"]),
        { from: window.from, to: null },
        "created_at"
      )
        .order("id")
        .range(from, to)
    ),
    (row) => row.id
  )

  const riddleOf = new Map<string, number>()
  const legacyOf = new Map<string, number>()
  for (const row of rows) {
    if (row.reason === "riddle_bonus") {
      if (row.reference_id) riddleOf.set(`${row.user_id}:${row.reference_id}`, (riddleOf.get(`${row.user_id}:${row.reference_id}`) ?? 0) + row.amount)
    } else if ((row.reason === "kiss_the_hand" || !row.reference_id) && inWindow(row.created_at, window)) {
      legacyOf.set(row.user_id, (legacyOf.get(row.user_id) ?? 0) + 1)
    }
  }

  const today = utcDay()
  const byUser = new Map<string, KissTally>()
  const blank = (userId: string): KissTally => ({
    userId,
    kisses: 0,
    reward: 0,
    riddle: 0,
    favor: 0,
    crowns: 0,
    scorns: 0,
    legacy: 0,
    today: false,
    todayCount: 0,
    avgRiddleMs: null,
    riddleMisses: 0,
    lastAt: null,
    recent: [],
  })
  const times = new Map<string, number[]>()
  for (const praise of uniqueBy(praises, (p) => p.id)) {
    const tally = byUser.get(praise.user_id) ?? blank(praise.user_id)
    const riddle = riddleOf.get(`${praise.user_id}:${praise.id}`) ?? 0
    tally.kisses++
    tally.reward += praise.reward
    tally.riddle += riddle
    tally.favor += praise.favor
    if (praise.verdict === "crowned") tally.crowns++
    if (praise.verdict === "scorned") tally.scorns++
    if (praise.praise_day === today) {
      tally.today = true
      tally.todayCount++
    }
    if (praise.riddle_ms != null) times.set(praise.user_id, [...(times.get(praise.user_id) ?? []), praise.riddle_ms])
    tally.riddleMisses += praise.riddle_misses ?? 0
    tally.lastAt ??= praise.created_at
    if (tally.recent.length < RECENT_PRAISES) tally.recent.push(toPraise(praise, praise.favor, praise.reward + riddle + praise.favor))
    byUser.set(praise.user_id, tally)
  }
  for (const [userId, values] of times) {
    const tally = byUser.get(userId)
    if (tally) tally.avgRiddleMs = average(values)
  }
  for (const [userId, legacy] of legacyOf) {
    const tally = byUser.get(userId) ?? blank(userId)
    tally.legacy = legacy
    byUser.set(userId, tally)
  }
  return { available: true, today, tallies: [...byUser.values()] }
}

export async function loadKissTallies(supabase: SupabaseClient, window: PlayedWindow): Promise<KissTallies> {
  const { data, error } = await supabase.rpc("praise_leaderboard", { p_from: window.from, p_to: window.to, p_limit: RECENT_PRAISES })
  if (!error) return fromRpc(data)
  if (!isMissingSchema(error)) throw new QueryError(error)
  return fromTables(supabase, window)
}

export interface Noble {
  name: string
  avatarUrl: string | null
  playerId: string | null
}

// Points first, then the number of praises; equal on both shares a rank (1, 2, 2, 4).
export function rankKisses(tallies: KissTally[], nobles: Map<string, Noble>): KissEntry[] {
  const entries = tallies.map((t) => {
    const noble = nobles.get(t.userId)
    return {
      rank: 0,
      userId: t.userId,
      playerId: noble?.playerId ?? null,
      name: noble?.name ?? "A nameless subject",
      avatarUrl: noble?.avatarUrl ?? null,
      kisses: t.kisses,
      points: t.reward + t.riddle + t.favor,
      reward: t.reward,
      riddle: t.riddle,
      favor: t.favor,
      crowns: t.crowns,
      scorns: t.scorns,
      legacy: t.legacy,
      today: t.today,
      todayCount: t.todayCount,
      avgRiddleMs: t.avgRiddleMs,
      riddleMisses: t.riddleMisses,
      lastAt: t.lastAt,
      recent: t.recent,
    }
  })
  entries.sort((x, y) => y.points - x.points || y.kisses - x.kisses || y.legacy - x.legacy || x.name.localeCompare(y.name))
  entries.forEach((entry, index) => {
    const previous = entries[index - 1]
    entry.rank = previous && previous.points === entry.points && previous.kisses === entry.kisses ? previous.rank : index + 1
  })
  return entries
}
