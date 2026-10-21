import type { GameHook } from "@/lib/game-hooks/types"

export const sideBetsHook: GameHook = {
  name: "side-bets",
  async onResolved({ supabase, sessionId, assignments }) {
    const { data: prophecies } = await supabase
      .from("prophecies")
      .select("*")
      .eq("session_id", sessionId)
      .is("correct", null)

    for (const prophecy of prophecies ?? []) {
      if (prophecy.prediction_type !== "player_gets_lane") continue
      const pv = prophecy.prediction_value as { player_id: string; lane: string }
      const isCorrect = assignments.some((a) => a.player_id === pv.player_id && a.lane === pv.lane)

      await supabase.from("prophecies").update({ correct: isCorrect }).eq("id", prophecy.id)
      if (!isCorrect) continue

      const { data: bet } = await supabase
        .from("bets")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", prophecy.user_id)
        .eq("status", "won")
        .maybeSingle()

      const bonus = bet && bet.payout > 0 ? Math.floor(bet.payout * (prophecy.multiplier - 1)) : 0
      if (bonus > 0) {
        await supabase.rpc("adjust_balance", {
          p_user_id: prophecy.user_id,
          p_amount: bonus,
          p_reason: "prophecy_bonus",
          p_reference_id: sessionId,
        })
      }
    }
  },
}
