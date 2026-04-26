import { CHAMPION_POOLS, type Champion } from "./champions"
import type { Assignment, Player, Role, Side } from "./types"

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function splitTeams(
  players: Player[]
): { blue: Player[]; red: Player[] } {
  const shuffled = shuffleArray(players)
  return {
    blue: shuffled.slice(0, 5),
    red: shuffled.slice(5, 10),
  }
}

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

export function assignLanes(
  team: Player[]
): Array<{ player: Player; lane: Role }> {
  const lanes = shuffleArray(LANE_ORDER)
  return team.map((player, i) => ({ player, lane: lanes[i] }))
}

export function assignChampions(
  blueTeam: Array<{ player: Player; lane: Role }>,
  redTeam: Array<{ player: Player; lane: Role }>,
  fearlessBanned: Set<string>,
  lockedAssignments: Map<string, Assignment>
): Assignment[] {
  const usedInThisRound = new Set<string>()
  const results: Assignment[] = []

  const allSlots = [
    ...blueTeam.map((s) => ({ ...s, side: "blue" as Side })),
    ...redTeam.map((s) => ({ ...s, side: "red" as Side })),
  ]

  for (const slot of allSlots) {
    const locked = lockedAssignments.get(slot.player.id)
    if (locked) {
      results.push(locked)
      usedInThisRound.add(locked.champion)
      continue
    }

    const pool = CHAMPION_POOLS[slot.lane]
    const available = pool.filter(
      (ch) => !fearlessBanned.has(ch.name) && !usedInThisRound.has(ch.name)
    )

    let chosen: Champion
    let fearlessOverride = false

    if (available.length > 0) {
      chosen = available[Math.floor(Math.random() * available.length)]
    } else {
      const fallback = pool.filter((ch) => !usedInThisRound.has(ch.name))
      chosen =
        fallback.length > 0
          ? fallback[Math.floor(Math.random() * fallback.length)]
          : pool[Math.floor(Math.random() * pool.length)]
      fearlessOverride = true
    }

    usedInThisRound.add(chosen.name)
    results.push({
      player: slot.player,
      side: slot.side,
      lane: slot.lane,
      champion: chosen.name,
      championInternal: chosen.internal,
      locked: false,
      fearlessOverride,
    })
  }

  return results
}

export function getAssignmentsByLane(assignments: Assignment[]) {
  return LANE_ORDER.map((lane) => ({
    lane,
    blue: assignments.find((a) => a.side === "blue" && a.lane === lane)!,
    red: assignments.find((a) => a.side === "red" && a.lane === lane)!,
  }))
}
