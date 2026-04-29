"use client"

import type { Assignment, PlayerRevealState, Role } from "@/lib/types"
import { PlayerCard } from "./player-card"
import { cn } from "@/lib/utils"

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

interface TeamListProps {
  assignments: Assignment[]
  playerStates?: Map<string, PlayerRevealState>
  shuffleImageUrls?: Map<string, string>
  onToggleLock?: (playerId: string) => void
  showLocks?: boolean
  activeLane?: Role | null
}

export function TeamList({
  assignments,
  playerStates,
  shuffleImageUrls,
  onToggleLock,
  showLocks = false,
  activeLane,
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
          const state: PlayerRevealState = playerStates?.get(assignment.player.id) ?? "revealed"
          const isActiveLaneRow = activeLane === assignment.lane

          if (state === "hidden") return null

          return (
            <div
              key={assignment.player.id}
              className={cn(
                "rounded-lg transition-all duration-300",
                isActiveLaneRow && state === "silhouette" && "bg-[var(--color-gold)]/5 ring-1 ring-[var(--color-gold)]/20"
              )}
            >
              <PlayerCard
                assignment={assignment}
                showLock={showLocks}
                onToggleLock={
                  onToggleLock
                    ? () => onToggleLock(assignment.player.id)
                    : undefined
                }
                state={state}
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
