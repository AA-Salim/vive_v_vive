import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { COACH_POOL_COOKIE, COACH_POOL_PATH } from "@/lib/lobby/constants"
import { readJson } from "@/lib/lobby/server/http"
import { StartCoachDraftSchema } from "@/lib/lobby/types"
import { errorResponse, loadSession, presentSession, sessionResponse } from "@/lib/session/server"

const PoolSchema = z
  .array(z.guid())
  .min(10)
  .max(40)
  .refine((ids) => new Set(ids).size === ids.length)

async function takeCookiePool(): Promise<string[] | undefined> {
  const jar = await cookies()
  const raw = jar.get(COACH_POOL_COOKIE)?.value
  if (raw === undefined) return undefined
  jar.set(COACH_POOL_COOKIE, "", { path: COACH_POOL_PATH, maxAge: 0 })
  const parsed = PoolSchema.safeParse(raw.split("."))
  return parsed.success ? parsed.data : undefined
}

export async function POST(request: Request) {
  const parsed = StartCoachDraftSchema.safeParse(await readJson(request))
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Pick two coaches", "invalid")
  const { blue_coach_id: blue, red_coach_id: red } = parsed.data
  const cookiePool = await takeCookiePool()
  const requestedPool = parsed.data.player_ids ?? cookiePool

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return errorResponse(401, "Sign in with Discord to start a coach draft.", "auth_required")

  const { data: coaches, error: coachError } = await supabase.from("user_profiles").select("id").in("id", [blue, red])
  if (coachError) return errorResponse(500, "Could not check the coaches. Try again.")
  if ((coaches ?? []).length !== 2) return errorResponse(400, "Both coaches need to have signed in here once.", "unknown_coach")

  let pool: string[] | null = null
  if (requestedPool) {
    const { data: rows, error: poolError } = await supabase.from("players").select("id").in("id", requestedPool).eq("is_active", true)
    if (poolError) return errorResponse(500, "Could not check the player pool. Try again.")
    pool = ((rows ?? []) as { id: string }[]).map((r) => r.id)
    if (pool.length < 10) return errorResponse(400, "The pool needs at least ten active players.", "small_pool")
  }

  const base: Record<string, unknown> = {
    status: "coach_draft",
    game_mode: "coach_draft",
    created_by: user.id,
    blue_coach_id: blue,
    red_coach_id: red,
    draft_turn: "blue",
  }
  let insert = await supabase.from("game_sessions").insert(pool ? { ...base, coach_pool: pool } : base).select("id").single()
  if (insert.error && pool && isMissingSchema(insert.error)) {
    insert = await supabase.from("game_sessions").insert(base).select("id").single()
  }
  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") return errorResponse(409, "A game is already running.", "active_session")
    return errorResponse(500, "Could not open the coach draft. Try again.")
  }

  const { session } = await loadSession(supabase, insert.data.id as string)
  if (!session) return errorResponse(500, "The draft was created but could not be loaded.")

  emitLive("session.created", { sessionId: session.id, actor: await getActor(supabase, user.id), data: { mode: "coach_draft" } })
  return sessionResponse(await presentSession(supabase, session), { status: 201 })
}
