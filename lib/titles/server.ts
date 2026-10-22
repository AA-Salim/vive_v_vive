import type { SupabaseClient } from "@supabase/supabase-js"
import { isCurseCategory, perkInfo, rarityOf, tierOf } from "@/lib/titles/catalog"
import { curseState, type ResolvedGame } from "@/lib/titles/curses"
import { combineEffects, effectSummary, type CombinedEffects, type EffectSource } from "@/lib/titles/effects"
import { loadoutSlotOf, primaryOf } from "@/lib/titles/loadout"
import { TITLE_LOCK_WINDOW_MS, dignityCost } from "@/lib/titles/rules"
import type { CurseState, EquippedTitle, LoadoutEntry, TitleCategory } from "@/lib/titles/types"

export interface TitleRow {
  id: string
  name: string
  description: string
  price: number
  category: TitleCategory
  for_self: boolean
  is_permanent: boolean
}

export interface OwnershipRow {
  id: string
  user_id: string
  title_id: string
  is_active: boolean
  assigned_by: string | null
  created_at: string
  // Added by supabase/phase10_title-effects.sql.
  equipped_at?: string | null
}

export interface OwnershipWithTitle extends OwnershipRow {
  title: Pick<TitleRow, "name" | "category" | "for_self" | "price">
}

export interface CourtIdentity {
  userId: string
  name: string
  username: string
  avatarUrl: string | null
  playerId: string | null
}

const TITLE_COLUMNS = "id, name, description, price, category, for_self, is_permanent"
// "*" keeps working before and after equipped_at exists.
const OWNERSHIP_COLUMNS = "*"

export async function loadTitles(supabase: SupabaseClient): Promise<TitleRow[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(TITLE_COLUMNS)
    .order("category")
    .order("price", { ascending: true })
  if (error) throw error
  return (data ?? []) as TitleRow[]
}

export async function loadOwnership(supabase: SupabaseClient): Promise<OwnershipRow[]> {
  const { data, error } = await supabase.from("user_titles").select(OWNERSHIP_COLUMNS)
  if (error) throw error
  return (data ?? []) as OwnershipRow[]
}

// Every equipped title plus every bestowed brand: the rows that can affect a game. Optionally for some users only.
export async function loadLiveOwnership(supabase: SupabaseClient, userIds?: string[]): Promise<OwnershipWithTitle[]> {
  let query = supabase
    .from("user_titles")
    .select(`${OWNERSHIP_COLUMNS}, titles ( name, category, for_self, price )`)
    .or("is_active.eq.true,assigned_by.not.is.null")
  if (userIds) {
    const ids = [...new Set(userIds.filter(Boolean))]
    if (ids.length === 0) return []
    query = query.in("user_id", ids)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const joined = (row as { titles?: unknown }).titles
    const title = (Array.isArray(joined) ? joined[0] : joined) as OwnershipWithTitle["title"] | null
    return title ? [{ ...(row as OwnershipRow), title }] : []
  })
}

export async function loadResolvedGames(supabase: SupabaseClient, since: string | null): Promise<ResolvedGame[]> {
  if (!since) return []
  const { data } = await supabase
    .from("game_sessions")
    .select("id, created_at")
    .in("status", ["blue_win", "red_win"])
    .gt("created_at", since)
  return (data ?? []).map((row) => ({ id: row.id as string, startedAt: Date.parse(row.created_at as string) }))
}

export async function loadIdentities(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, CourtIdentity>> {
  const ids = [...new Set(userIds.filter(Boolean))]
  const identities = new Map<string, CourtIdentity>()
  if (ids.length === 0) return identities

  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase.from("user_profiles").select("id, discord_username, discord_avatar_url").in("id", ids),
    supabase.from("players").select("id, name, auth_user_id").in("auth_user_id", ids),
  ])
  const playerByUser = new Map((players ?? []).map((p) => [p.auth_user_id as string, p as { id: string; name: string }]))

  for (const profile of profiles ?? []) {
    const player = playerByUser.get(profile.id as string)
    identities.set(profile.id as string, {
      userId: profile.id as string,
      name: player?.name ?? (profile.discord_username as string),
      username: profile.discord_username as string,
      avatarUrl: (profile.discord_avatar_url as string | null) ?? null,
      playerId: player?.id ?? null,
    })
  }
  return identities
}

export async function loadAllIdentities(supabase: SupabaseClient): Promise<CourtIdentity[]> {
  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase.from("user_profiles").select("id, discord_username, discord_avatar_url"),
    supabase.from("players").select("id, name, auth_user_id").not("auth_user_id", "is", null),
  ])
  const playerByUser = new Map((players ?? []).map((p) => [p.auth_user_id as string, p as { id: string; name: string }]))
  return (profiles ?? []).map((profile) => {
    const player = playerByUser.get(profile.id as string)
    return {
      userId: profile.id as string,
      name: player?.name ?? (profile.discord_username as string),
      username: profile.discord_username as string,
      avatarUrl: (profile.discord_avatar_url as string | null) ?? null,
      playerId: player?.id ?? null,
    }
  })
}

// Titles are sealed while a game is live. A session stuck in game for hours does not count.
export async function titlesLocked(supabase: SupabaseClient): Promise<boolean> {
  const since = new Date(Date.now() - TITLE_LOCK_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_game")
    .gt("updated_at", since)
  return (count ?? 0) > 0
}

export function earliest(dates: string[]): string | null {
  if (dates.length === 0) return null
  return dates.reduce((min, d) => (Date.parse(d) < Date.parse(min) ? d : min))
}

export function isBrand(row: { assigned_by: string | null }, title: { category: string; for_self: boolean }): boolean {
  return !!row.assigned_by && !title.for_self && isCurseCategory(title.category)
}

export function brandState(row: OwnershipRow, price: number, resolved: ResolvedGame[], excludeSessionId?: string): CurseState {
  return curseState(row.created_at, resolved, price, excludeSessionId)
}

// ============================================================
// Live title state per user: the loadout and the brands still burning
// ============================================================

export interface LiveBrand extends OwnershipWithTitle {
  left: number
}

export interface LiveTitles {
  equipped: OwnershipWithTitle[]
  curses: LiveBrand[]
}

export async function loadLiveTitles(supabase: SupabaseClient, userIds?: string[]): Promise<Map<string, LiveTitles>> {
  const rows = await loadLiveOwnership(supabase, userIds)
  const brands = rows.filter((r) => isBrand(r, r.title))
  const resolved = await loadResolvedGames(supabase, earliest(brands.map((b) => b.created_at)))
  const byUser = new Map<string, LiveTitles>()
  const entry = (userId: string) => {
    let state = byUser.get(userId)
    if (!state) {
      state = { equipped: [], curses: [] }
      byUser.set(userId, state)
    }
    return state
  }
  for (const row of rows) {
    if (row.is_active) entry(row.user_id).equipped.push(row)
    if (!isBrand(row, row.title)) continue
    const state = brandState(row, row.title.price, resolved)
    if (state.active) entry(row.user_id).curses.push({ ...row, left: state.left })
  }
  return byUser
}

export function effectSourcesOf(state: LiveTitles | undefined): EffectSource[] {
  if (!state) return []
  return [
    ...state.equipped.filter((r) => r.title.for_self).map((r) => ({ title: r.title.name, kind: "equipped" as const })),
    ...state.curses.map((r) => ({ title: r.title.name, kind: "curse" as const })),
  ]
}

// The combined immediate effects of one user. Never throws: a missing table only means no effects.
export async function loadUserEffects(supabase: SupabaseClient, userId: string | null | undefined): Promise<CombinedEffects> {
  if (!userId) return combineEffects([])
  try {
    const states = await loadLiveTitles(supabase, [userId])
    return combineEffects(effectSourcesOf(states.get(userId)))
  } catch {
    return combineEffects([])
  }
}

export async function loadEffectsFor(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, CombinedEffects>> {
  const out = new Map<string, CombinedEffects>()
  try {
    const states = await loadLiveTitles(supabase, userIds)
    for (const id of userIds) out.set(id, combineEffects(effectSourcesOf(states.get(id))))
  } catch {
    for (const id of userIds) out.set(id, combineEffects([]))
  }
  return out
}

function loadoutEntries(equipped: OwnershipWithTitle[]): LoadoutEntry[] {
  const items = equipped.map((row) => ({
    name: row.title.name,
    category: row.title.category,
    tier: tierOf(row.title.name, row.title.category, row.title.price),
    equippedAt: row.equipped_at ?? null,
    row,
  }))
  const primary = primaryOf(items)
  const ordered = primary ? [primary, ...items.filter((i) => i !== primary)] : items
  return ordered.map((item) => {
    const curse = isCurseCategory(item.category)
    const info = curse ? null : perkInfo(item.name, item.category)
    return {
      title: item.name,
      category: item.category,
      rarity: rarityOf(item.name, item.category, item.row.title.price),
      tier: item.tier,
      slot: loadoutSlotOf(item),
      effect: curse ? null : effectSummary(item.name),
      perk: info?.summary ?? null,
      primary: item === primary,
    }
  })
}

export async function buildEquippedTitles(supabase: SupabaseClient): Promise<EquippedTitle[]> {
  const states = await loadLiveTitles(supabase)
  const identities = await loadIdentities(
    supabase,
    [...states.entries()].flatMap(([userId, s]) => [userId, ...s.curses.map((c) => c.assigned_by ?? "")])
  )

  const out: EquippedTitle[] = []
  for (const [userId, state] of states) {
    const curses = state.curses.map((brand) => {
      const bestower = identities.get(brand.assigned_by ?? "")?.name ?? null
      const info = perkInfo(brand.title.name, brand.title.category, bestower ?? "whoever branded them")
      return {
        title: brand.title.name,
        perk: info?.summary ?? "",
        bestowedBy: bestower,
        gamesLeft: brand.left,
        cap: info?.cap,
        price: brand.title.price,
        dignityCost: dignityCost(brand.title.price),
        effect: effectSummary(brand.title.name),
        tier: tierOf(brand.title.name, brand.title.category, brand.title.price),
      }
    })
    const loadout = loadoutEntries(state.equipped)
    const playerId = identities.get(userId)?.playerId ?? null
    const primary = loadout[0]

    if (primary) {
      // A brand worn as a banner is described as the curse it still is.
      const wornBrand = isCurseCategory(primary.category) ? curses.find((c) => c.title === primary.title) : undefined
      out.push({
        userId,
        playerId,
        title: primary.title,
        category: primary.category,
        perk: wornBrand?.perk ?? primary.perk,
        kind: wornBrand ? "curse" : primary.perk ? "perk" : "cosmetic",
        rarity: primary.rarity,
        price: state.equipped.find((row) => row.title.name === primary.title)?.title.price,
        tier: primary.tier,
        effect: wornBrand?.effect ?? primary.effect,
        curses,
        loadout,
      })
    } else if (curses.length > 0) {
      const [first] = curses
      out.push({
        userId,
        playerId,
        title: first.title,
        category: "mockery",
        perk: first.perk,
        kind: "curse",
        rarity: "cursed",
        tier: first.tier,
        effect: first.effect,
        curses,
        loadout: [],
      })
    }
  }
  return out
}
