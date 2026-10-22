import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import type { ExpiredWarrant } from "@/lib/bounties/server/board"

interface HunterShare {
  user_id: string
  name: string
  share: number
}

interface ClaimedWarrant {
  warrant_id: string
  target_name: string | null
  target_user_id: string | null
  payout: number
  hunters: HunterShare[]
}

interface EscapedWarrant {
  warrant_id: string
  target_name: string | null
  target_user_id: string | null
  bonus: number
  price: number
  escapes: number
}

interface LegacyClaim {
  target_name: string | null
  target_user_id: string | null
  poster_user_id: string
  payout: number
}

interface Settlement {
  settled: boolean
  claimed?: ClaimedWarrant[]
  escaped?: EscapedWarrant[]
  legacy_claimed?: LegacyClaim[]
}

function announce(sessionId: string, result: Settlement) {
  for (const w of result.claimed ?? []) {
    const hunters = Array.isArray(w.hunters) ? w.hunters : []
    emitLive("bounty.claimed", {
      sessionId,
      data: {
        targetName: w.target_name ?? "Someone",
        amount: w.payout,
        hunters: hunters.length,
        targetUserId: w.target_user_id,
        hunterNames: hunters.map((h) => h.name),
        hunterUserIds: hunters.map((h) => h.user_id),
        share: hunters.reduce((max, h) => Math.max(max, h.share), 0),
      },
    })
  }
  for (const w of result.escaped ?? []) {
    emitLive("bounty.escaped", {
      sessionId,
      data: {
        targetName: w.target_name ?? "Someone",
        bonus: w.bonus,
        total: w.price,
        escapes: w.escapes,
        targetUserId: w.target_user_id,
      },
    })
  }
  for (const b of result.legacy_claimed ?? []) {
    emitLive("bounty.claimed", {
      sessionId,
      data: {
        targetName: b.target_name ?? "Someone",
        amount: b.payout,
        hunters: 1,
        targetUserId: b.target_user_id,
        hunterUserIds: [b.poster_user_id],
        legacy: true,
      },
    })
  }
}

// Settles every warrant on the players of a recorded game. Idempotent: a retried declaration only settles
// what the first run did not reach. Before the migration, the legacy function keeps the old bounties working.
// A transient failure is retried once: the session flips to its result right after the hooks, so a game whose
// settlement fails here is never settled later.
export async function settleSessionBounties(supabase: SupabaseClient, sessionId: string, loserIds: string[]): Promise<void> {
  const settle = () => supabase.rpc("bounty_settle_session", { p_session_id: sessionId })
  let { data, error } = await settle()
  if (error && !isMissingSchema(error)) ({ data, error } = await settle())
  if (error) {
    if (!isMissingSchema(error)) throw new Error(error.message)
    const legacy = await supabase.rpc("resolve_bounties", { p_session_id: sessionId, p_loser_player_ids: loserIds })
    if (legacy.error) throw new Error(legacy.error.message)
    return
  }
  const result = (data ?? { settled: false }) as Settlement
  if (result.settled) announce(sessionId, result)
}

export function announceExpired(expired: ExpiredWarrant[]) {
  for (const w of expired) {
    emitLive("bounty.expired", {
      data: {
        targetName: w.target_name ?? "Someone",
        refunded: w.refunded,
        backers: w.backers,
        targetUserId: w.target_user_id,
      },
    })
  }
}
