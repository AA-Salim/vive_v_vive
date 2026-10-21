import type { PraiseViolation } from "@/lib/praise/rules"

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
  canSing: boolean
  today: PraiseView | null
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
  resetsAt: string
}

export interface JudgeResult {
  praise: PraiseView
  crownsLeft: number
}
