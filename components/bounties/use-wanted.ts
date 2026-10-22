"use client"

import { useMemo } from "react"
import { useBountyBoard } from "@/components/bounties/use-bounties"
import { useAuthUser } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { TIMED_STATUSES } from "@/lib/live/events"
import type { WarrantView } from "@/lib/bounties/types"

// Open warrants by target player, read from the shared board cache (no extra request when the panel is mounted).
export function useWanted(): Map<string, WarrantView> {
  const { user } = useAuthUser()
  const board = useBountyBoard(user?.id ?? null)
  const warrants = board.data?.warrants
  return useMemo(() => {
    const byPlayer = new Map<string, WarrantView>()
    for (const w of warrants ?? []) {
      const current = byPlayer.get(w.target.playerId)
      if (!current || w.price > current.price) byPlayer.set(w.target.playerId, w)
    }
    return byPlayer
  }, [warrants])
}

// Players locked into the game in progress (decrees, betting, in game): warrants on them settle when it ends.
export function useOnTheRift(): Set<string> {
  const { session } = useSession()
  return useMemo(() => {
    if (!session || !TIMED_STATUSES.includes(session.status)) return new Set<string>()
    return new Set(session.session_assignments.map((a) => a.player_id))
  }, [session])
}
