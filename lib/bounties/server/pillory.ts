import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import { shameStats, type PlayedGame } from "@/lib/bounties/shame-stats"
import { loadIdentities, personOf, targetOf, viewerFrom, type Identities } from "@/lib/bounties/server/identities"
import type { PilloryEntryView, PilloryLoss, PilloryPreview, PilloryWall, TribunalVerdict } from "@/lib/bounties/types"
import type { Role, Side } from "@/lib/types"

interface EntryRow {
  id: string
  shamer_user_id: string | null
  target_player_id: string
  message: string | null
  worst_stat_label: string
  worst_stat_value: string
  recent_losses: unknown
  expires_at: string
  created_at: string
  source?: string | null
  cost?: number | null
  details?: Record<string, unknown> | null
  eggs?: number | null
}

interface TribunalCreated {
  entry_id: string
  session_id: string
  target_player_id: string
  target_name: string | null
  target_user_id: string | null
  votes: number
  ballots: number
}

interface GameRow {
  side: Side
  lane: Role
  champion: string
  games: { played_at: string; winner_side: Side } | { played_at: string; winner_side: Side }[] | null
}

const LEGACY_COLUMNS = "id, shamer_user_id, target_player_id, message, worst_stat_label, worst_stat_value, recent_losses, expires_at, created_at"
const FULL_COLUMNS = `${LEGACY_COLUMNS}, source, cost, details, eggs`
const LANES: readonly string[] = ["top", "jungle", "mid", "adc", "support"]

function lossesOf(value: unknown): PilloryLoss[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const r = item as Record<string, unknown>
    if (typeof r.champion !== "string") return []
    return [{ champion: r.champion, lane: typeof r.lane === "string" ? r.lane : "", playedAt: typeof r.played_at === "string" ? r.played_at : "" }]
  })
}

function verdictOf(details: Record<string, unknown> | null | undefined): TribunalVerdict {
  const d = details ?? {}
  const lane = typeof d.lane === "string" && LANES.includes(d.lane) ? (d.lane as Role) : null
  return {
    votes: Number(d.votes) || 0,
    ballots: Number(d.ballots) || 0,
    champion: typeof d.champion === "string" ? d.champion : null,
    lane,
    shared: d.shared === true,
  }
}

function toEntry(row: EntryRow, ids: Identities, thrown: Set<string>): PilloryEntryView {
  const tribunal = row.source === "tribunal"
  return {
    id: row.id,
    kind: tribunal ? "tribunal" : "user",
    target: targetOf(ids, row.target_player_id),
    shamer: tribunal || !row.shamer_user_id ? null : personOf(ids, row.shamer_user_id),
    message: row.message ?? "",
    stat: { label: row.worst_stat_label, value: row.worst_stat_value },
    recentLosses: lossesOf(row.recent_losses).slice(0, 3),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    eggs: row.eggs ?? 0,
    thrown: thrown.has(row.id),
    cost: row.cost ?? null,
    tribunal: tribunal ? verdictOf(row.details) : null,
  }
}

function announceTribunal(created: TribunalCreated[]) {
  for (const entry of created) {
    emitLive("shame.posted", {
      sessionId: entry.session_id,
      actor: { userId: null, name: "The Tribunal" },
      data: {
        targetName: entry.target_name ?? "Someone",
        message: entry.ballots > 0 ? `Voted Inter by ${entry.votes} of ${entry.ballots} ballots` : "Voted Inter",
        targetUserId: entry.target_user_id,
        source: "tribunal",
      },
    })
  }
}

// The Tribunal's Inter verdicts go up on the wall lazily (exactly once per vote and player, guarded in SQL).
export async function syncTribunal(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("pillory_sync_tribunal")
    if (error) return !isMissingSchema(error)
    const created = (Array.isArray(data) ? data : []) as TribunalCreated[]
    announceTribunal(created)
    return true
  } catch {
    return true
  }
}

// Eggs only exist on live entries (24 hours plus at most 12 extra), so the viewer's recent ones are enough.
const EGG_LOOKBACK_MS = (PILLORY_RULES.hours + PILLORY_RULES.eggMaxHours) * 60 * 60 * 1000

export async function loadWall(supabase: SupabaseClient): Promise<PilloryWall> {
  const [synced, ids, viewerUser] = await Promise.all([syncTribunal(supabase), loadIdentities(supabase), supabase.auth.getUser()])
  const viewer = viewerFrom(viewerUser.data.user?.id ?? null, ids)
  const nowIso = new Date().toISOString()

  const entries = (columns: string) =>
    supabase.from("shame_entries").select(columns).gt("expires_at", nowIso).order("created_at", { ascending: false }).limit(40)
  const userId = synced ? viewer.userId : null
  const [first, eggs, lastPost] = await Promise.all([
    entries(synced ? FULL_COLUMNS : LEGACY_COLUMNS),
    userId
      ? supabase
          .from("shame_eggs")
          .select("entry_id")
          .eq("user_id", userId)
          .gte("created_at", new Date(Date.now() - EGG_LOOKBACK_MS).toISOString())
      : Promise.resolve({ data: [] as { entry_id: string }[] }),
    userId
      ? supabase
          .from("shame_entries")
          .select("created_at")
          .eq("shamer_user_id", userId)
          .eq("source", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let available = synced
  let res = first
  if (available && isMissingSchema(res.error)) {
    available = false
    res = await entries(LEGACY_COLUMNS)
  }
  if (res.error) throw res.error
  const rows = (res.data ?? []) as unknown as EntryRow[]

  const thrown = new Set<string>(available ? ((eggs.data ?? []) as { entry_id: string }[]).map((t) => t.entry_id) : [])
  let nextPostAt: string | null = null
  const last = available ? (lastPost.data as { created_at?: string } | null)?.created_at : undefined
  if (last) {
    const next = Date.parse(last) + PILLORY_RULES.cooldownHours * 60 * 60 * 1000
    if (next > Date.now()) nextPostAt = new Date(next).toISOString()
  }

  return {
    available,
    entries: rows.map((row) => toEntry(row, ids, thrown)),
    viewer: { ...viewer, nextPostAt },
  }
}

export async function loadPlayedGames(supabase: SupabaseClient, playerId: string): Promise<PlayedGame[]> {
  const { data, error } = await supabase
    .from("game_players")
    .select("side, lane, champion, games!inner ( played_at, winner_side )")
    .eq("player_id", playerId)
  if (error) throw error
  return ((data ?? []) as unknown as GameRow[]).flatMap((row) => {
    const game = Array.isArray(row.games) ? row.games[0] : row.games
    if (!game) return []
    return [{ playedAt: game.played_at, won: game.winner_side === row.side, champion: row.champion, lane: row.lane }]
  })
}

export function recentLossRows(games: PlayedGame[]) {
  return [...games]
    .filter((g) => !g.won)
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    .slice(0, 3)
    .map((g) => ({ played_at: g.playedAt, champion: g.champion, lane: g.lane }))
}

export async function loadPreview(supabase: SupabaseClient, playerId: string): Promise<PilloryPreview | null> {
  const [{ data: player }, games] = await Promise.all([
    supabase.from("players").select("id, name").eq("id", playerId).maybeSingle(),
    loadPlayedGames(supabase, playerId),
  ])
  if (!player) return null
  const [stat, ...alternatives] = shameStats(games, Date.now())
  return {
    playerId,
    name: (player as { name: string }).name,
    stat,
    alternatives: alternatives.slice(0, 3),
    recentLosses: recentLossRows(games).map((l) => ({ champion: l.champion, lane: l.lane, playedAt: l.played_at })),
  }
}
