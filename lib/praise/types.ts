import type { PraiseRules, PraiseViolation } from "@/lib/praise/rules"
import type { EffectNote } from "@/lib/titles/effects"

export type PraiseVerdict = "crowned" | "scorned"

export interface PraiseAuthor {
  userId: string
  name: string
  avatarUrl: string | null
}

export interface PraiseView {
  id: string
  body: string
  reward: number
  favor: number
  verdict: PraiseVerdict | null
  verdictNote: string | null
  judgedAt: string | null
  createdAt: string
  praiseDay: string
  author: PraiseAuthor
}

export interface PraiseMe {
  userId: string
  // True while a kiss is left today.
  canSing: boolean
  // The latest praise of the day.
  today: PraiseView | null
  sungToday: number
  remainingToday: number
  // The daily slot the next kiss takes and its base reward, null once all are sung.
  nextSlot: number | null
  nextReward: number | null
  total: number
  crowned: number
  favor: number
  legacy: number
  isSalaxe: boolean
}

export interface PraiseCourt {
  pending: number
  crownsLeft: number
  crownLimit: number
}

export interface PraiseStateReady {
  available: true
  today: string
  resetsAt: string
  serverNow: string
  // The rules the live submit_praise enforces (the legacy ones until the version 2 migration runs).
  rules: PraiseRules
  reward: number
  favor: number
  totalCount: number
  salaxeUserId: string | null
  me: PraiseMe | null
  court: PraiseCourt | null
  featured: PraiseView | null
}

export type PraiseState = { available: false } | PraiseStateReady

export const HALL_VIEWS = ["latest", "crowned", "mine", "court"] as const
export type HallView = (typeof HALL_VIEWS)[number]

export interface HallPage {
  available: boolean
  praises: PraiseView[]
  hasMore: boolean
}

export type SubmitErrorCode =
  | PraiseViolation
  | "already_sung"
  | "duplicate"
  | "too_similar"
  | "not_authenticated"
  | "no_balance"
  | "riddle_required"
  | "invalid_input"
  | "migration_pending"
  | "unknown"

export type JudgeErrorCode =
  | "not_authenticated"
  | "not_salaxe"
  | "invalid_verdict"
  | "note_too_long"
  | "not_found"
  | "own_praise"
  | "already_judged"
  | "crown_limit"
  | "author_unavailable"
  | "invalid_input"
  | "migration_pending"
  | "unknown"

export interface SubmitResult {
  praise: PraiseView
  balance: number
  riddleBonus: number
  // The daily slot this kiss took, the kisses a day and the ones left, with the next one's base reward.
  slot: number
  perDay: number
  baseReward: number
  remainingToday: number
  nextReward: number | null
  // How long the kiss's riddles took, first posed to solved, and how many were missed (null without a riddle).
  riddleMs: number | null
  riddleMisses: number | null
  resetsAt: string
  // The titles that raised this praise's reward.
  titleEffects?: EffectNote[]
}

export interface JudgeResult {
  praise: PraiseView
  crownsLeft: number
}

export type RiddleKind = "sequence" | "arrows" | "maze"

export interface SequencePuzzle {
  terms: number[]
  options: number[]
}

// Directions 0..7, clockwise from up, 45 degrees apart.
export interface ArrowPuzzle {
  arrows: number[]
}

// tiles: one letter per cell, row by row (I straight, L corner, T tee). rotations: clockwise quarter turns.
// The entry opens on the west side of row `entry`, the exit on the east side of row `exit`.
export interface MazePuzzle {
  size: number
  tiles: string
  rotations: number[]
  entry: number
  exit: number
}

export type Riddle =
  | { kind: "sequence"; puzzle: SequencePuzzle }
  | { kind: "arrows"; puzzle: ArrowPuzzle }
  | { kind: "maze"; puzzle: MazePuzzle }

export interface RiddleSolution {
  value?: number
  rule?: string
  a?: number | null
  b?: number | null
  rotations?: number[]
  path?: number[]
}

export type RiddleStatus = "open" | "solved" | "locked"

export interface RiddleView {
  day: string
  // The daily kiss slot this riddle opens (1 before the daily kiss slots migration).
  slot: number
  status: RiddleStatus
  number: number
  limit: number
  misses: number
  firstTry: boolean | null
  bonus: number
  riddle: Riddle
  solution: RiddleSolution | null
  solvedAt: string | null
  resetsAt: string
  // The clock of an open riddle: seconds for its kind and when it runs out. Null before the riddle clock migration.
  timeLimit: number | null
  deadline: string | null
  serverNow: string | null
  // Date.now() minus serverNow, measured by the browser when the view arrived (withClock in hooks/use-praise.ts).
  clockOffset: number
}


export type RiddleAnswer = { value: number } | { rotations: number[] } | { skip: true } | { timeout: true }

export type RiddleOutcome = "correct" | "wrong" | "skipped" | "timeout" | "already_solved" | "stale"

export interface RetiredRiddle {
  riddle: Riddle
  solution: RiddleSolution
}

export interface RiddleSolveResult {
  outcome: RiddleOutcome
  view: RiddleView
  previous: RetiredRiddle | null
}

export type RiddleState =
  | { available: false }
  // timedOut: the riddle on screen ran out while nobody watched; it was lost when this view was read.
  | ({ available: true; timedOut?: RetiredRiddle | null } & RiddleView)

export type RiddleErrorCode =
  | "not_authenticated"
  | "already_sung"
  | "no_riddle"
  | "riddle_limit"
  | "invalid_answer"
  | "invalid_input"
  | "migration_pending"
  | "unknown"
