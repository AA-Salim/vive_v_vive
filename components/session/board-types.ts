import type { EquippedTitle } from "@/app/api/titles/equipped/route"
import type { PlayerRevealState, Role, Side } from "@/lib/types"
import type { RoomAssignment } from "@/lib/session/types"
import type { Champion } from "@/lib/champions"
import type { RevealFrame } from "@/components/session/reveal"

export const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

export interface BoardViewProps {
  assignments: RoomAssignment[]
  frame: RevealFrame | null
  titles: Map<string, EquippedTitle>
  winner: Side | null
  draft: boolean
  canLock: boolean
  pendingLocks: Set<string>
  onToggleLock?: (assignmentId: string) => void
  animateLayout: boolean
  meId: string | null
}

export function slotState(frame: RevealFrame | null, playerId: string): PlayerRevealState {
  return frame?.states.get(playerId) ?? "revealed"
}

export function slotShuffle(frame: RevealFrame | null, playerId: string): Champion | null {
  return frame?.shuffle.get(playerId) ?? null
}

export function outcomeFor(winner: Side | null, side: Side): "won" | "lost" | null {
  if (!winner) return null
  return winner === side ? "won" : "lost"
}

export function byLane(a: RoomAssignment, b: RoomAssignment) {
  return LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane)
}
