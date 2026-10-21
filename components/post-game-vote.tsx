"use client"

import { Tribunal } from "@/components/prophecy/tribunal"
import { RESOLVED_STATUSES } from "@/lib/prophecy/constants"
import type { SessionWithAssignments } from "@/lib/types"

// The post-game tribunal for a resolved session: vote MVP and Inter, then the verdict and prophecy payouts.
export function PostGameVote({ session }: { session: SessionWithAssignments }) {
  if (!RESOLVED_STATUSES.includes(session.status)) return null
  return <Tribunal sessionId={session.id} />
}

export { TribunalCallout } from "@/components/prophecy/tribunal-callout"
