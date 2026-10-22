import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { nextEscapeBonus } from "@/lib/bounties/rules"
import { loadIdentities, personOf, targetOf, viewerFrom, type Identities } from "@/lib/bounties/server/identities"
import type { BountyBoard, HuntHunter, HuntRecord, WarrantView } from "@/lib/bounties/types"

interface PledgeRow {
  user_id: string
  amount: number
  status: string
}

interface WarrantRow {
  id: string
  target_player_id: string
  status: "open" | "claimed" | "expired"
  pledged: number
  crown_bonus: number
  escapes: number
  opened_at: string
  expires_at: string
  closed_at: string | null
  payout: number
  hunters: unknown
  bounty_pledges: PledgeRow[] | null
}

interface LegacyRow {
  id: string
  poster_user_id: string
  target_player_id: string
  amount: number
  payout_multiplier: number | string
  expires_at: string
  created_at: string
}

export interface ExpiredWarrant {
  warrant_id: string
  target_player_id: string
  target_name: string | null
  target_user_id: string | null
  refunded: number
  backers: number
  escapes: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WARRANT_SELECT =
  "id, target_player_id, status, pledged, crown_bonus, escapes, opened_at, expires_at, closed_at, payout, hunters, bounty_pledges ( user_id, amount, status )"

function toWarrant(row: WarrantRow, ids: Identities, viewerId: string | null): WarrantView {
  const backers = (row.bounty_pledges ?? [])
    .filter((p) => p.status === "pledged")
    .map((p) => ({ ...personOf(ids, p.user_id), userId: p.user_id, amount: p.amount }))
    .sort((a, b) => b.amount - a.amount)
  return {
    id: row.id,
    kind: "warrant",
    target: targetOf(ids, row.target_player_id),
    pledged: row.pledged,
    crownBonus: row.crown_bonus,
    price: row.pledged + row.crown_bonus,
    escapes: row.escapes,
    openedAt: row.opened_at,
    expiresAt: row.expires_at,
    backers,
    mine: backers.find((b) => b.userId === viewerId)?.amount ?? 0,
    nextEscapeBonus: nextEscapeBonus(row.pledged, row.crown_bonus),
    legacyPayout: null,
  }
}

function toLegacy(row: LegacyRow, ids: Identities, viewerId: string | null): WarrantView {
  const poster = personOf(ids, row.poster_user_id)
  return {
    id: row.id,
    kind: "legacy",
    target: targetOf(ids, row.target_player_id),
    pledged: row.amount,
    crownBonus: 0,
    price: row.amount,
    escapes: 0,
    openedAt: row.created_at,
    expiresAt: row.expires_at,
    backers: [{ userId: row.poster_user_id, name: poster.name, avatarUrl: poster.avatarUrl, amount: row.amount }],
    mine: row.poster_user_id === viewerId ? row.amount : 0,
    nextEscapeBonus: 0,
    legacyPayout: Math.floor(row.amount * Number(row.payout_multiplier || 1.5)),
  }
}

function huntersOf(value: unknown): HuntHunter[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((h) => {
    if (!h || typeof h !== "object") return []
    const r = h as Record<string, unknown>
    if (typeof r.user_id !== "string") return []
    return [{ userId: r.user_id, name: typeof r.name === "string" ? r.name : "Someone", share: Number(r.share) || 0 }]
  })
}

function toHunt(row: WarrantRow, ids: Identities): HuntRecord {
  return {
    id: row.id,
    outcome: row.status === "claimed" ? "claimed" : "expired",
    target: targetOf(ids, row.target_player_id),
    price: row.status === "claimed" ? row.payout : row.pledged,
    escapes: row.escapes,
    backers: (row.bounty_pledges ?? []).length,
    closedAt: row.closed_at ?? row.expires_at,
    hunters: huntersOf(row.hunters),
  }
}

// Expired warrants are refunded lazily by whoever reads the board first (exactly once, guarded in SQL).
async function sweep(supabase: SupabaseClient): Promise<{ available: boolean; expired: ExpiredWarrant[] }> {
  try {
    const { data, error } = await supabase.rpc("bounty_sweep")
    if (error) return { available: !isMissingSchema(error), expired: [] }
    const expired = (data as { expired?: ExpiredWarrant[] } | null)?.expired
    return { available: true, expired: Array.isArray(expired) ? expired : [] }
  } catch {
    return { available: true, expired: [] }
  }
}

// Reads already filter on expires_at, so the sweep runs alongside them; its events refresh every board.
export async function loadBoard(supabase: SupabaseClient): Promise<{ board: BountyBoard; expired: ExpiredWarrant[] }> {
  const nowIso = new Date().toISOString()
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

  const [swept, ids, viewerUser, openRes, recentRes, legacyRes] = await Promise.all([
    sweep(supabase),
    loadIdentities(supabase),
    supabase.auth.getUser(),
    supabase.from("bounty_warrants").select(WARRANT_SELECT).eq("status", "open").gt("expires_at", nowIso),
    supabase
      .from("bounty_warrants")
      .select(WARRANT_SELECT)
      .neq("status", "open")
      .gte("closed_at", weekAgo)
      .order("closed_at", { ascending: false })
      .limit(8),
    supabase
      .from("bounties")
      .select("id, poster_user_id, target_player_id, amount, payout_multiplier, expires_at, created_at")
      .eq("status", "active")
      .gt("expires_at", nowIso),
  ])

  const available = swept.available && !isMissingSchema(openRes.error)
  if (openRes.error && !isMissingSchema(openRes.error)) throw openRes.error
  if (legacyRes.error && !isMissingSchema(legacyRes.error)) throw legacyRes.error
  const viewer = viewerFrom(viewerUser.data.user?.id ?? null, ids)

  const warrants = [
    ...(available ? ((openRes.data ?? []) as WarrantRow[]).map((row) => toWarrant(row, ids, viewer.userId)) : []),
    ...((legacyRes.data ?? []) as LegacyRow[]).map((row) => toLegacy(row, ids, viewer.userId)),
  ].sort((a, b) => b.price - a.price || Date.parse(a.expiresAt) - Date.parse(b.expiresAt))

  const recent = available && !recentRes.error ? ((recentRes.data ?? []) as WarrantRow[]).map((row) => toHunt(row, ids)) : []

  return { board: { available, warrants, recent, viewer }, expired: swept.expired }
}

export async function loadRoster(supabase: SupabaseClient) {
  const ids = await loadIdentities(supabase)
  return [...ids.players.values()]
    .filter((p) => p.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}
