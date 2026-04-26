"use client"

import type { Assignment, Role } from "@/lib/types"
import { PlayerCard } from "./player-card"

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

interface TeamListProps {
  assignments: Assignment[]
  visiblePlayerIds?: Set<string>
  shufflingPlayerIds?: Set<string>
  shuffleImageUrls?: Map<string, string>
  onToggleLock?: (playerId: string) => void
  showLocks?: boolean
}

export function TeamList({
  assignments,
  visiblePlayerIds,
  shufflingPlayerIds,
  shuffleImageUrls,
  onToggleLock,
  showLocks = false,
}: TeamListProps) {
  const blue = assignments.filter((a) => a.side === "blue")
  const red = assignments.filter((a) => a.side === "red")

  const sortByLane = (arr: Assignment[]) =>
    [...arr].sort(
      (a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane)
    )

  const renderTeam = (team: Assignment[], label: string, color: string) => (
    <div className="flex-1">
      <h3
        className="mb-3 text-center text-sm font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </h3>
      <div className="space-y-1">
        {sortByLane(team).map((assignment) => {
          const isVisible =
            !visiblePlayerIds || visiblePlayerIds.has(assignment.player.id)
          const isShuffling = shufflingPlayerIds?.has(assignment.player.id)

          if (!isVisible) return null

          return (
            <div
              key={assignment.player.id}
              className="animate-player-enter"
            >
              <PlayerCard
                assignment={assignment}
                showLock={showLocks}
                onToggleLock={
                  onToggleLock
                    ? () => onToggleLock(assignment.player.id)
                    : undefined
                }
                isShuffling={isShuffling}
                shuffleImageUrl={shuffleImageUrls?.get(assignment.player.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      {renderTeam(blue, "Blue Side", "var(--color-blue-team)")}
      {renderTeam(red, "Red Side", "var(--color-red-team)")}
    </div>
  )
}
