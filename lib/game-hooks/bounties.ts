import type { GameHook } from "@/lib/game-hooks/types"

export const bountiesHook: GameHook = {
  name: "bounties",
  async onResolved({ supabase, sessionId, loserIds }) {
    await supabase.rpc("resolve_bounties", { p_session_id: sessionId, p_loser_player_ids: loserIds })
  },
}
