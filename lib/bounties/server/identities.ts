import type { SupabaseClient } from "@supabase/supabase-js"
import type { PersonRef, RosterPlayer, TargetRef } from "@/lib/bounties/types"

interface PlayerRow {
  id: string
  name: string
  is_active: boolean
  auth_user_id: string | null
}

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
}

export interface Identities {
  players: Map<string, RosterPlayer>
  users: Map<string, PersonRef & { userId: string; playerId: string | null }>
}

// The whole court is ~30 players and ~30 accounts: one read of each beats a dozen targeted lookups.
export async function loadIdentities(supabase: SupabaseClient): Promise<Identities> {
  const [playersRes, profilesRes] = await Promise.all([
    supabase.from("players").select("id, name, is_active, auth_user_id"),
    // Oldest first, like vvv_bounty_account(): when two profiles claim one player, both sides pick the same account.
    supabase.from("user_profiles").select("id, discord_username, discord_avatar_url, player_id").order("created_at"),
  ])
  const players = (playersRes.data ?? []) as PlayerRow[]
  const profiles = (profilesRes.data ?? []) as ProfileRow[]
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const profileByPlayer = new Map<string, ProfileRow>()
  for (const profile of profiles) {
    if (profile.player_id && !profileByPlayer.has(profile.player_id)) profileByPlayer.set(profile.player_id, profile)
  }

  const playerMap = new Map<string, RosterPlayer>()
  const playerOfUser = new Map<string, PlayerRow>()
  for (const player of players) {
    const userId = player.auth_user_id ?? profileByPlayer.get(player.id)?.id ?? null
    const profile = userId ? profileById.get(userId) : undefined
    playerMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      userId,
      avatarUrl: profile?.discord_avatar_url ?? null,
      isActive: player.is_active,
    })
    if (userId && !playerOfUser.has(userId)) playerOfUser.set(userId, player)
  }

  const users: Identities["users"] = new Map()
  for (const profile of profiles) {
    const player = (profile.player_id ? players.find((p) => p.id === profile.player_id) : undefined) ?? playerOfUser.get(profile.id)
    users.set(profile.id, {
      userId: profile.id,
      name: player?.name || profile.discord_username || "Someone",
      avatarUrl: profile.discord_avatar_url ?? null,
      playerId: player?.id ?? null,
    })
  }

  return { players: playerMap, users }
}

export function targetOf(ids: Identities, playerId: string, fallbackName = "Unknown"): TargetRef {
  const player = ids.players.get(playerId)
  return {
    playerId,
    name: player?.name ?? fallbackName,
    userId: player?.userId ?? null,
    avatarUrl: player?.avatarUrl ?? null,
  }
}

export function personOf(ids: Identities, userId: string | null): PersonRef {
  if (!userId) return { userId: null, name: "Someone", avatarUrl: null }
  const user = ids.users.get(userId)
  return { userId, name: user?.name ?? "Someone", avatarUrl: user?.avatarUrl ?? null }
}

export function viewerFrom(userId: string | null, ids: Identities): { userId: string | null; playerId: string | null } {
  if (!userId) return { userId: null, playerId: null }
  const linked = [...ids.players.values()].find((p) => p.userId === userId)
  return { userId, playerId: ids.users.get(userId)?.playerId ?? linked?.playerId ?? null }
}
