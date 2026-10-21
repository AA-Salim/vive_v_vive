import type { SupabaseClient } from "@supabase/supabase-js"

export interface LobbyViewer {
  userId: string | null
  isAdmin: boolean
  playerId: string | null
  playerName: string | null
}

const ANONYMOUS: LobbyViewer = { userId: null, isAdmin: false, playerId: null, playerName: null }

export async function getLobbyViewer(supabase: SupabaseClient): Promise<LobbyViewer> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return ANONYMOUS
  const { data } = await supabase.from("players").select("id, name, is_admin").eq("auth_user_id", user.id).maybeSingle()
  return {
    userId: user.id,
    isAdmin: !!data?.is_admin,
    playerId: data?.id ?? null,
    playerName: data?.name ?? null,
  }
}

// Players act for themselves; admins may act for anyone.
export function resolveTarget(viewer: LobbyViewer, requested: string | undefined): { playerId: string } | { error: string; status: number } {
  if (requested && requested !== viewer.playerId) {
    if (!viewer.isAdmin) return { error: "You can only do that for your own player.", status: 403 }
    return { playerId: requested }
  }
  if (!viewer.playerId) return { error: "Claim your player on your profile first.", status: 409 }
  return { playerId: viewer.playerId }
}
