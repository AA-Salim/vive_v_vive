import { LOBBY_SIZE, TEAM_SIZE } from "@/lib/lobby/constants"
import type { RotationMode } from "@/lib/lobby/types"
import type { Side } from "@/lib/types"

export interface RotationInput {
  winners: string[]
  satOut: string[]
  losers: string[]
  volunteers: string[]
  queue: string[]
}

export interface RotationPlan {
  staying: string[]
  comingIn: string[]
  loyal: string[]
  lottery: { seats: number; among: string[] }
  forced: string[]
  rotatingOut: string[]
  short: number
}

export interface RotationDraw {
  lineup: string[]
  stayingLosers: string[]
  rotatingOut: string[]
}

type Rng = () => number

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Winners keep their seats, the queue fills the rest in order, and losers only stay when the queue runs dry
// (volunteers first, then by lot). Winners who sat out are the last resort.
export function planRotation(input: RotationInput): RotationPlan {
  const lastGame = new Set([...input.winners, ...input.satOut, ...input.losers])
  const staying = [...new Set(input.winners)]
  let seats = Math.max(0, LOBBY_SIZE - staying.length)

  const comingIn = input.queue.filter((id, i, all) => !lastGame.has(id) && all.indexOf(id) === i).slice(0, seats)
  seats -= comingIn.length

  const volunteers = new Set(input.volunteers)
  const eager = input.losers.filter((id) => volunteers.has(id))
  const reluctant = input.losers.filter((id) => !volunteers.has(id))

  let loyal: string[] = []
  let lottery: RotationPlan["lottery"] = { seats: 0, among: [] }
  for (const group of [eager, reluctant]) {
    if (seats === 0) break
    if (group.length <= seats) {
      loyal = [...loyal, ...group]
      seats -= group.length
    } else {
      lottery = { seats, among: group }
      seats = 0
    }
  }

  const forced = input.satOut.slice(0, seats)
  seats -= forced.length

  const kept = new Set([...loyal, ...lottery.among])
  return {
    staying,
    comingIn,
    loyal,
    lottery,
    forced,
    rotatingOut: input.losers.filter((id) => !kept.has(id)),
    short: seats,
  }
}

export function drawRotation(plan: RotationPlan, rng: Rng = Math.random): RotationDraw {
  const lucky = shuffle(plan.lottery.among, rng).slice(0, plan.lottery.seats)
  const stayingLosers = [...plan.loyal, ...lucky]
  return {
    lineup: [...plan.staying, ...plan.comingIn, ...stayingLosers, ...plan.forced],
    stayingLosers,
    rotatingOut: [...plan.rotatingOut, ...plan.lottery.among.filter((id) => !lucky.includes(id))],
  }
}

// "throne": the winners defend together and the challengers form the other team. "shuffle": all ten are mixed.
export function formTeams(
  lineup: string[],
  champions: string[],
  mode: RotationMode,
  rng: Rng = Math.random
): Record<Side, string[]> {
  if (mode === "shuffle") {
    const mixed = shuffle(lineup, rng)
    return { blue: mixed.slice(0, TEAM_SIZE), red: mixed.slice(TEAM_SIZE, LOBBY_SIZE) }
  }
  const crowned = new Set(champions.filter((id) => lineup.includes(id)).slice(0, TEAM_SIZE))
  const rest = shuffle(
    lineup.filter((id) => !crowned.has(id)),
    rng
  )
  const defenders = [...crowned, ...rest.slice(0, TEAM_SIZE - crowned.size)]
  const challengers = rest.slice(TEAM_SIZE - crowned.size)
  return rng() < 0.5 ? { blue: defenders, red: challengers } : { blue: challengers, red: defenders }
}
