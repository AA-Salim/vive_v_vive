import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { findInsult } from "@/lib/praise/insults"
import { cleanPraise, COURT_WINDOW_DAYS, PRAISE_INPUT_MAX, praiseExcerpt } from "@/lib/praise/rules"
import {
  PRAISE_COLUMNS,
  asSubmitError,
  findSalaxeUserId,
  loadAuthors,
  submitFailure,
  toPraiseView,
  withAuthors,
  type PraiseRow,
  type SubmitRpcResult,
} from "@/lib/praise/server"
import { HALL_VIEWS, type HallPage, type SubmitResult } from "@/lib/praise/types"
import { noteText, parseNotes } from "@/lib/titles/effects"

const HallQuery = z.object({
  view: z.enum(HALL_VIEWS).default("latest"),
  limit: z.coerce.number().int().min(1).max(150).default(30),
})

const SubmitBody = z.object({
  body: z.string().max(PRAISE_INPUT_MAX * 2),
})

export async function GET(request: NextRequest) {
  const parsed = HallQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid hall query", code: "invalid_input" }, { status: 400 })
  }
  const { view, limit } = parsed.data
  const supabase = await createClient()

  let query = supabase.from("praises").select(PRAISE_COLUMNS)
  if (view === "crowned") {
    query = query.eq("verdict", "crowned").order("judged_at", { ascending: false })
  } else if (view === "mine") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated", code: "not_authenticated" }, { status: 401 })
    query = query.eq("user_id", user.id).order("created_at", { ascending: false })
  } else if (view === "court") {
    const salaxeId = await findSalaxeUserId(supabase)
    const since = new Date(Date.now() - COURT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    query = query.is("verdict", null).gte("created_at", since).order("created_at", { ascending: false })
    if (salaxeId) query = query.neq("user_id", salaxeId)
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const { data, error } = await query.limit(limit + 1)
  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ available: false, praises: [], hasMore: false } satisfies HallPage)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as PraiseRow[]
  const praises = await withAuthors(supabase, rows.slice(0, limit))
  return NextResponse.json(
    { available: true, praises, hasMore: rows.length > limit } satisfies HallPage,
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return submitFailure("not_authenticated")

  const parsed = SubmitBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return submitFailure("invalid_input")

  // Only the insult filter runs here: the length and word rules depend on which submit_praise is live (see
  // praise_state rules_version), and the database applies them.
  const body = cleanPraise(parsed.data.body)
  if (findInsult(body)) return submitFailure("insult")

  const { data, error } = await supabase.rpc("submit_praise", { p_body: body })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("Sing His Praises")
    return submitFailure("unknown")
  }

  const result = data as SubmitRpcResult
  if (!result.ok) {
    const code = asSubmitError(result.error)
    const matchId = result.match_user_id ?? null
    const matchName = matchId && matchId !== user.id ? (await loadAuthors(supabase, [matchId])).get(matchId)?.name : null
    return submitFailure(code, matchName)
  }

  const authors = await loadAuthors(supabase, [user.id])
  const praise = toPraiseView(result.praise, authors)
  const titleEffects = parseNotes(result.title_effects)

  emitLive("praise.sung", {
    actor: { userId: user.id, name: praise.author.name, avatarUrl: praise.author.avatarUrl },
    data: {
      excerpt: praiseExcerpt(praise.body),
      reward: praise.reward,
      praiseId: praise.id,
      titleEffects: titleEffects.length ? titleEffects.map(noteText) : undefined,
    },
  })

  return NextResponse.json({
    praise,
    balance: result.balance,
    riddleBonus: result.riddle_bonus ?? 0,
    resetsAt: result.resets_at,
    titleEffects,
  } satisfies SubmitResult)
}
