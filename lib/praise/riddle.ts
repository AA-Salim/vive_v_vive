import type { MazePuzzle, Riddle, RiddleSolution } from "@/lib/praise/types"

export const ARROW_NAMES = ["Up", "Up right", "Right", "Down right", "Down", "Down left", "Left", "Up left"] as const

export const NORTH = 1
export const EAST = 2
export const SOUTH = 4
export const WEST = 8

// Mirrors riddle_tile_mask in supabase/phase10_riddles.sql: openings after clockwise quarter turns.
const TILE_MASKS: Record<string, readonly number[]> = {
  I: [NORTH | SOUTH, EAST | WEST, NORTH | SOUTH, EAST | WEST],
  L: [NORTH | EAST, EAST | SOUTH, SOUTH | WEST, WEST | NORTH],
  T: [NORTH | EAST | SOUTH, EAST | SOUTH | WEST, SOUTH | WEST | NORTH, WEST | NORTH | EAST],
}

export const TILE_NAMES: Record<string, string> = { I: "straight pipe", L: "corner pipe", T: "tee pipe" }

const OPPOSITE: Record<number, number> = { [NORTH]: SOUTH, [EAST]: WEST, [SOUTH]: NORTH, [WEST]: EAST }

export function tileMask(type: string, rotation: number): number {
  return TILE_MASKS[type]?.[((rotation % 4) + 4) % 4] ?? 0
}

function neighbour(cell: number, dir: number, size: number): number | null {
  const row = Math.floor(cell / size)
  const col = cell % size
  if (dir === NORTH) return row > 0 ? cell - size : null
  if (dir === SOUTH) return row < size - 1 ? cell + size : null
  if (dir === EAST) return col < size - 1 ? cell + 1 : null
  return col > 0 ? cell - 1 : null
}

export interface MazeFlow {
  reached: ReadonlySet<number>
  connected: boolean
}

// Mirrors riddle_maze_connected: water enters the west side of the entry cell and flows through openings
// that face each other. The server decides; this only lights the pipes and knows when to submit.
export function mazeFlow(puzzle: Pick<MazePuzzle, "size" | "tiles" | "entry" | "exit">, rotations: readonly number[]): MazeFlow {
  const { size, tiles, entry, exit } = puzzle
  const masks = Array.from(tiles, (type, i) => tileMask(type, rotations[i] ?? 0))
  const start = entry * size
  const goal = exit * size + size - 1
  const reached = new Set<number>()
  if (!(masks[start] & WEST)) return { reached, connected: false }
  reached.add(start)
  const queue = [start]
  while (queue.length) {
    const cell = queue.shift()!
    for (const dir of [NORTH, EAST, SOUTH, WEST]) {
      if (!(masks[cell] & dir)) continue
      const next = neighbour(cell, dir, size)
      if (next === null || reached.has(next) || !(masks[next] & OPPOSITE[dir])) continue
      reached.add(next)
      queue.push(next)
    }
  }
  return { reached, connected: reached.has(goal) && !!(masks[goal] & EAST) }
}

function turnPhrase(step: number): string {
  const notches = ((step % 8) + 8) % 8
  if (notches === 4) return "a half turn"
  const degrees = (notches <= 4 ? notches : 8 - notches) * 45
  return `${degrees} degrees ${notches <= 4 ? "clockwise" : "counterclockwise"}`
}

// The rule behind a retired or solved riddle, in one plain sentence.
export function explainRiddle(riddle: Riddle, solution: RiddleSolution | null): string | null {
  if (!solution) return null
  const a = solution.a ?? 0
  const b = solution.b ?? 0
  if (riddle.kind === "maze") return "Any unbroken pipe from the entry to the exit does the job."
  if (riddle.kind === "arrows") {
    if (solution.rule === "turn") return a === 4 ? "It flips around every step." : `It turns ${turnPhrase(a)} every step.`
    if (solution.rule === "alternate") return `It alternates: ${turnPhrase(a)}, then ${turnPhrase(b)}.`
    if (solution.rule === "grow") return `Each turn is 45 degrees wider than the last, ${a > 0 ? "clockwise" : "counterclockwise"}.`
    return null
  }
  switch (solution.rule) {
    case "add":
      return `Add ${a} every time.`
    case "subtract":
      return `Take away ${a} every time.`
    case "double":
      return "Each number doubles."
    case "triple":
      return "Each number triples."
    case "halve":
      return "Each number is cut in half."
    case "squares":
      return "Square numbers, one after the other."
    case "growing":
      return `The step grows by one each time: +${a}, +${a + 1}, +${a + 2}...`
    case "fibonacci":
      return "Each number is the sum of the two before it."
    case "alternate":
      return `Up ${a}, down ${b}, again and again.`
    case "double_plus_one":
      return "Double it, then add one."
    default:
      return null
  }
}

export function riddleAnswerLabel(riddle: Riddle, solution: RiddleSolution | null): string | null {
  if (!solution || solution.value === undefined || riddle.kind === "maze") return null
  return riddle.kind === "arrows" ? (ARROW_NAMES[solution.value] ?? null) : String(solution.value)
}
