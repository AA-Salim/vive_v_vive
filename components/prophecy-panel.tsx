"use client"

import { ProphecyBoardView } from "@/components/prophecy/prophecy-board"
import type { SessionWithAssignments } from "@/lib/types"

interface ProphecyPanelProps {
  session: SessionWithAssignments
  isBettingOpen: boolean
}

// MVP / Inter prophecies: sealed during chaos or betting, settled by the post-game vote.
export function ProphecyPanel({ session, isBettingOpen }: ProphecyPanelProps) {
  return <ProphecyBoardView sessionId={session.id} sealingAllowed={isBettingOpen || session.status === "chaos"} />
}
