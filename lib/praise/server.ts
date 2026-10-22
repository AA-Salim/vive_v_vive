import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PraiseViolation } from "@/lib/praise/rules"
import type {
  JudgeErrorCode,
  PraiseAuthor,
  PraiseVerdict,
  PraiseView,
  Riddle,
  RiddleErrorCode,
  RiddleOutcome,
  RiddleSolution,
  RiddleStatus,
  RiddleView,
  SubmitErrorCode,
} from "@/lib/praise/types"
import { judgeErrorMessage, riddleErrorMessage, submitErrorMessage } from "@/lib/praise/voice"

export const PRAISE_COLUMNS =
  "id, user_id, body, reward, favor, verdict, verdict_note, judged_at, created_at, praise_day"

export interface PraiseRow {
  id: string
  user_id: string
  body: string
  reward: number
  favor: number
  verdict: PraiseVerdict | null
  verdict_note: string | null
  judged_at: string | null
  created_at: string
  praise_day: string
}

export interface PraiseStateRow {
  today: string
  resets_at: string
  server_now: string
  user_id: string | null
  salaxe_user_id: string | null
  total_count: number
  pending_count: number
  crowns_today: number
  today_id: string | null
  my_total: number
  my_crowned: number
  my_favor: number
  my_legacy: number
}

export type SubmitRpcResult =
  | { ok: true; praise: PraiseRow; balance: number; riddle_bonus?: number; resets_at: string }
  | { ok: false; error: string; match_user_id?: string | null; resets_at?: string }

export type JudgeRpcResult =
  | { ok: true; praise: PraiseRow; author_balance: number | null; crowns_left: number }
  | { ok: false; error: string; verdict?: PraiseVerdict }

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  players: { name: string | null } | { name: string | null }[] | null
}

const ANONYMOUS_AUTHOR = "A nameless subject"

export async function loadAuthors(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, PraiseAuthor>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))]
  const authors = new Map<string, PraiseAuthor>()
  if (ids.length === 0) return authors
  const { data } = await supabase
    .from("user_profiles")
    .select("id, discord_username, discord_avatar_url, players:player_id ( name )")
    .in("id", ids)
  for (const row of (data ?? []) as ProfileRow[]) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players
    authors.set(row.id, {
      userId: row.id,
      name: player?.name || row.discord_username || ANONYMOUS_AUTHOR,
      avatarUrl: row.discord_avatar_url ?? null,
    })
  }
  return authors
}

export function toPraiseView(row: PraiseRow, authors: Map<string, PraiseAuthor>): PraiseView {
  return {
    id: row.id,
    body: row.body,
    reward: row.reward,
    favor: row.favor,
    verdict: row.verdict,
    verdictNote: row.verdict_note,
    judgedAt: row.judged_at,
    createdAt: row.created_at,
    praiseDay: row.praise_day,
    author: authors.get(row.user_id) ?? { userId: row.user_id, name: ANONYMOUS_AUTHOR, avatarUrl: null },
  }
}

export async function withAuthors(supabase: SupabaseClient, rows: PraiseRow[]): Promise<PraiseView[]> {
  const authors = await loadAuthors(supabase, rows.map((row) => row.user_id))
  return rows.map((row) => toPraiseView(row, authors))
}

export async function findSalaxeUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("players")
    .select("auth_user_id")
    .ilike("name", "salaxe")
    .not("auth_user_id", "is", null)
    .order("created_at")
    .limit(1)
  return (data?.[0]?.auth_user_id as string | undefined) ?? null
}

const VIOLATIONS: readonly PraiseViolation[] = [
  "too_short",
  "too_long",
  "too_few_words",
  "no_name",
  "keyboard_mash",
  "repetitive",
  "too_many_symbols",
  "prompt_copy",
]

const SUBMIT_STATUS: Partial<Record<SubmitErrorCode, number>> = {
  already_sung: 409,
  duplicate: 409,
  too_similar: 409,
  no_balance: 409,
  riddle_required: 428,
  not_authenticated: 401,
  invalid_input: 400,
  unknown: 500,
}

export function asSubmitError(code: string): SubmitErrorCode {
  const known: readonly string[] = [
    ...VIOLATIONS,
    "already_sung",
    "duplicate",
    "too_similar",
    "not_authenticated",
    "no_balance",
    "riddle_required",
  ]
  return known.includes(code) ? (code as SubmitErrorCode) : "unknown"
}

export function submitFailure(code: SubmitErrorCode, matchName?: string | null) {
  const status = SUBMIT_STATUS[code] ?? (VIOLATIONS.includes(code as PraiseViolation) ? 422 : 500)
  return NextResponse.json({ error: submitErrorMessage(code, matchName), code }, { status })
}

const JUDGE_STATUS: Record<JudgeErrorCode, number> = {
  not_authenticated: 401,
  not_salaxe: 403,
  own_praise: 403,
  invalid_verdict: 400,
  note_too_long: 400,
  invalid_input: 400,
  not_found: 404,
  already_judged: 409,
  crown_limit: 409,
  author_unavailable: 409,
  migration_pending: 503,
  unknown: 500,
}

export function asJudgeError(code: string): JudgeErrorCode {
  return Object.hasOwn(JUDGE_STATUS, code) ? (code as JudgeErrorCode) : "unknown"
}

export function judgeFailure(code: JudgeErrorCode) {
  return NextResponse.json({ error: judgeErrorMessage(code), code }, { status: JUDGE_STATUS[code] })
}

interface RiddleRpcView {
  day: string
  status: RiddleStatus
  number: number
  limit: number
  misses: number
  first_try: boolean | null
  bonus: number
  kind: Riddle["kind"]
  puzzle: Riddle["puzzle"]
  solution: RiddleSolution | null
  solved_at: string | null
  resets_at: string
}

export type RiddleRpcResult =
  | (RiddleRpcView & {
      ok: true
      result?: RiddleOutcome
      previous?: { kind: Riddle["kind"]; puzzle: Riddle["puzzle"]; solution: RiddleSolution }
    })
  | { ok: false; error: string }

export function toRiddle(kind: Riddle["kind"], puzzle: Riddle["puzzle"]): Riddle {
  return { kind, puzzle } as Riddle
}

export function toRiddleView(row: RiddleRpcView): RiddleView {
  return {
    day: row.day,
    status: row.status,
    number: row.number,
    limit: row.limit,
    misses: row.misses,
    firstTry: row.first_try,
    bonus: row.bonus,
    riddle: toRiddle(row.kind, row.puzzle),
    solution: row.solution ?? null,
    solvedAt: row.solved_at,
    resetsAt: row.resets_at,
  }
}

const RIDDLE_STATUS: Record<RiddleErrorCode, number> = {
  not_authenticated: 401,
  no_riddle: 409,
  riddle_limit: 409,
  invalid_answer: 422,
  invalid_input: 400,
  migration_pending: 503,
  unknown: 500,
}

export function asRiddleError(code: string): RiddleErrorCode {
  return Object.hasOwn(RIDDLE_STATUS, code) ? (code as RiddleErrorCode) : "unknown"
}

export function riddleFailure(code: RiddleErrorCode) {
  return NextResponse.json({ error: riddleErrorMessage(code), code }, { status: RIDDLE_STATUS[code] })
}
