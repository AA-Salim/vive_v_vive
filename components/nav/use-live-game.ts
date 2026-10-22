"use client"

import { useSession } from "@/hooks/use-session"
import { ACTIVE_STATUSES } from "@/lib/live/events"
import { livePhaseLabel } from "@/components/nav/nav-links"

export function useLiveGame() {
  const { session } = useSession()
  const status = session?.status ?? null
  const active = !!status && ACTIVE_STATUSES.includes(status)
  return { active, label: active ? livePhaseLabel(status) : null }
}
