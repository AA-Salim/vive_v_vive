import type { SupabaseClient } from "@supabase/supabase-js"
import type { Duelist } from "@/lib/duels/types"
import type { Side } from "@/lib/types"

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
  players: { name?: string } | { name?: string }[] | null
}

interface LinkedPlayerRow {
  id: string
  name: string
  auth_user_id: string
}

export interface Account extends Duelist {
  playerIds: string[]
}

const PROFILE_COLUMNS = "id, discord_username, discord_avatar_url, player_id, players:player_id ( name )"

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// An account reaches its player through user_profiles.player_id or players.auth_user_id; like duel_player_side()
// in the migration, both links count.
function toAccount(userId: string, profile: ProfileRow | undefined, linked: LinkedPlayerRow[]): Account {
  const playerIds = [...new Set([profile?.player_id, ...linked.map((p) => p.id)].filter((id): id is string => !!id))]
  return {
    userId,
    name: one(profile?.players)?.name || linked[0]?.name || profile?.discord_username || "Someone",
    avatarUrl: profile?.discord_avatar_url ?? null,
    playerId: playerIds[0] ?? null,
    playerIds,
  }
}

// Every account when userIds is omitted. strict: throw on any failed read instead of degrading to bare names.
export async function loadAccounts(
  supabase: SupabaseClient,
  userIds?: (string | null | undefined)[],
  strict = false
): Promise<Map<string, Account>> {
  const ids = userIds ? [...new Set(userIds.filter((id): id is string => !!id))] : null
  const accounts = new Map<string, Account>()
  if (ids && ids.length === 0) return accounts

  const profilesQuery = supabase.from("user_profiles").select(PROFILE_COLUMNS)
  const playersQuery = supabase.from("players").select("id, name, auth_user_id")
  const [profiles, players] = await Promise.all([
    ids ? profilesQuery.in("id", ids) : profilesQuery,
    ids ? playersQuery.in("auth_user_id", ids) : playersQuery.not("auth_user_id", "is", null),
  ])
  if (strict && (profiles.error || players.error)) {
    throw new Error(profiles.error?.message ?? players.error?.message ?? "Could not read the court registry")
  }

  const linked = new Map<string, LinkedPlayerRow[]>()
  for (const player of (players.data ?? []) as LinkedPlayerRow[]) {
    linked.set(player.auth_user_id, [...(linked.get(player.auth_user_id) ?? []), player])
  }
  const profileRows = (profiles.data ?? []) as ProfileRow[]
  for (const row of profileRows) accounts.set(row.id, toAccount(row.id, row, linked.get(row.id) ?? []))
  for (const id of ids ?? []) {
    if (!accounts.has(id)) accounts.set(id, toAccount(id, undefined, linked.get(id) ?? []))
  }
  return accounts
}

// Mirrors duel_player_side(): Blue wins a tie, exactly like its ORDER BY side LIMIT 1.
export async function playerSideOf(supabase: SupabaseClient, sessionId: string, account: Account | undefined): Promise<Side | null> {
  if (!account || account.playerIds.length === 0) return null
  const { data } = await supabase
    .from("session_assignments")
    .select("side")
    .eq("session_id", sessionId)
    .in("player_id", account.playerIds)
  const sides = ((data ?? []) as { side?: unknown }[]).map((row) => row.side)
  if (sides.includes("blue")) return "blue"
  if (sides.includes("red")) return "red"
  return null
}
