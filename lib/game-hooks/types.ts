import type { SupabaseClient } from "@supabase/supabase-js"
import type { Role, Side } from "@/lib/types"

export interface HookAssignment {
  player_id: string
  side: Side
  lane: Role
  champion: string
  players: { id: string; name: string }
}

export interface GameResolvedContext {
  supabase: SupabaseClient
  sessionId: string
  gameId: string
  winnerSide: Side
  assignments: HookAssignment[]
  winnerIds: string[]
  loserIds: string[]
}

export interface GameCanceledContext {
  supabase: SupabaseClient
  sessionId: string
}

export interface GameHook {
  name: string
  onResolved?: (ctx: GameResolvedContext) => Promise<void>
  onCanceled?: (ctx: GameCanceledContext) => Promise<void>
}
