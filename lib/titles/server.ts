import type { SupabaseClient } from "@supabase/supabase-js"
import { isCurseCategory, perkInfo, rarityOf } from "@/lib/titles/catalog"
import { curseState, type ResolvedGame } from "@/lib/titles/curses"
import { TITLE_LOCK_WINDOW_MS } from "@/lib/titles/rules"
import type { CurseState, EquippedTitle, TitleCategory } from "@/lib/titles/types"

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
const OWNERSHIP_COLUMNS = "id, user_id, title_id, is_active, assigned_by, created_at"

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

// Every equipped title plus every bestowed brand: the rows that can affect a game.
export async function loadLiveOwnership(supabase: SupabaseClient): Promise<OwnershipWithTitle[]> {
  const { data, error } = await supabase
    .from("user_titles")
    .select(`${OWNERSHIP_COLUMNS}, titles ( name, category, for_self, price )`)
    .or("is_active.eq.true,assigned_by.not.is.null")
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const joined = row.titles as unknown
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

export async function buildEquippedTitles(supabase: SupabaseClient): Promise<EquippedTitle[]> {
  const rows = await loadLiveOwnership(supabase)
  const brands = rows.filter((r) => isBrand(r, r.title))
  const [resolved, identities] = await Promise.all([
    loadResolvedGames(supabase, earliest(brands.map((b) => b.created_at))),
    loadIdentities(supabase, rows.flatMap((r) => [r.user_id, r.assigned_by ?? ""])),
  ])

  const byUser = new Map<string, EquippedTitle>()
  const cursesByUser = new Map<string, NonNullable<EquippedTitle["curses"]>>()

  for (const brand of brands) {
    const state = brandState(brand, brand.title.price, resolved)
    if (!state.active) continue
    const bestower = identities.get(brand.assigned_by ?? "")?.name ?? null
    const list = cursesByUser.get(brand.user_id) ?? []
    list.push({
      title: brand.title.name,
      perk: perkInfo(brand.title.name, brand.title.category, bestower ?? "whoever branded them")?.summary ?? "",
      bestowedBy: bestower,
      gamesLeft: state.left,
    })
    cursesByUser.set(brand.user_id, list)
  }

  for (const row of rows) {
    if (!row.is_active || byUser.has(row.user_id)) continue
    const cursed = isCurseCategory(row.title.category)
    const info = cursed ? null : perkInfo(row.title.name, row.title.category)
    byUser.set(row.user_id, {
      userId: row.user_id,
      playerId: identities.get(row.user_id)?.playerId ?? null,
      title: row.title.name,
      category: row.title.category,
      perk: info?.summary ?? null,
      kind: info ? info.kind : "cosmetic",
      rarity: rarityOf(row.title.name, row.title.category, row.title.price),
      curses: cursesByUser.get(row.user_id) ?? [],
    })
  }

  for (const [userId, curses] of cursesByUser) {
    if (byUser.has(userId) || curses.length === 0) continue
    const [first] = curses
    byUser.set(userId, {
      userId,
      playerId: identities.get(userId)?.playerId ?? null,
      title: first.title,
      category: "mockery",
      perk: first.perk,
      kind: "curse",
      rarity: "cursed",
      curses,
    })
  }

  return [...byUser.values()]
}
