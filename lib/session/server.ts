import { NextResponse } from "next/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { emitLive, getActor } from "@/lib/live/server"
import type { LiveActor } from "@/lib/live/events"
import type { SessionStatus } from "@/lib/types"
import { BETTING_DURATION_MS, RESULT_STATUSES, RESULT_WINDOW_MS } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"

export const SESSION_SELECT = `
  *,
  session_assignments (
    *,
    players:player_id ( id, name )
  )
`

export type SessionRow = Omit<RoomSession, "recent_result" | "creator" | "resolver">

export type ActionOutcome =
  | { ok: true; session: SessionRow; changed: boolean }
  | { ok: false; status: number; error: string; code?: string }

export const fail = (status: number, error: string, code?: string): ActionOutcome => ({ ok: false, status, error, code })

interface DbError {
  code?: string
  message?: string
}

export function sessionResponse(body: unknown, init: { status?: number } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { "x-server-time": new Date().toISOString(), "cache-control": "no-store" },
  })
}

export function errorResponse(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, {
    status,
    headers: { "x-server-time": new Date().toISOString(), "cache-control": "no-store" },
  })
}

export async function loadSession(
  supabase: SupabaseClient,
  id: string
): Promise<{ session: SessionRow | null; error: DbError | null }> {
  const { data, error } = await supabase.from("game_sessions").select(SESSION_SELECT).eq("id", id).maybeSingle()
  return { session: (data as SessionRow | null) ?? null, error }
}

export async function loadLatestSession(
  supabase: SupabaseClient
): Promise<{ session: SessionRow | null; error: DbError | null }> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select(SESSION_SELECT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return { session: (data as SessionRow | null) ?? null, error }
}

// Compare-and-set: only applies when the row is still in `from`, so racing clients advance a phase at most once.
export async function transitionSession(
  supabase: SupabaseClient,
  sessionId: string,
  from: SessionStatus | SessionStatus[],
  patch: Record<string, unknown>
): Promise<{ session: SessionRow | null; error: DbError | null }> {
  let query = supabase
    .from("game_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
  query = Array.isArray(from) ? query.in("status", from) : query.eq("status", from)
  const { data, error } = await query.select(SESSION_SELECT).maybeSingle()
  return { session: (data as SessionRow | null) ?? null, error }
}

export function isRecentResult(session: SessionRow, now = Date.now()): boolean {
  if (!RESULT_STATUSES.includes(session.status)) return false
  const endedAt = Date.parse(session.updated_at)
  return !Number.isNaN(endedAt) && now - endedAt <= RESULT_WINDOW_MS
}

export async function presentSession(supabase: SupabaseClient, session: SessionRow): Promise<RoomSession> {
  const ids = [...new Set([session.created_by, session.resolved_by].filter((id): id is string => !!id))]
  const actors = new Map<string, LiveActor | null>()
  await Promise.all(ids.map(async (id) => actors.set(id, await getActor(supabase, id))))
  return {
    ...session,
    recent_result: RESULT_STATUSES.includes(session.status) || undefined,
    creator: session.created_by ? actors.get(session.created_by) ?? null : null,
    resolver: session.resolved_by ? actors.get(session.resolved_by) ?? null : null,
  }
}

export interface Viewer {
  user: User | null
  isAdmin: boolean
}

export async function getViewer(supabase: SupabaseClient): Promise<Viewer> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false }
  const { data } = await supabase.from("players").select("is_admin").eq("auth_user_id", user.id).maybeSingle()
  return { user, isAdmin: !!data?.is_admin }
}

export function canControlSession(viewer: Viewer, session: Pick<SessionRow, "created_by">): boolean {
  if (!viewer.user) return false
  if (viewer.isAdmin) return true
  return !session.created_by || session.created_by === viewer.user.id
}

// Timers keep running when the host is offline: any read past the deadline moves the game forward once.
export async function advanceExpiredPhase(supabase: SupabaseClient, session: SessionRow): Promise<SessionRow> {
  const now = Date.now()
  const expired = (value: string | null) => !!value && Date.parse(value) <= now

  if (session.status === "chaos" && expired(session.chaos_ends_at)) {
    const { session: next } = await transitionSession(supabase, session.id, "chaos", {
      status: "betting",
      betting_ends_at: new Date(now + BETTING_DURATION_MS).toISOString(),
    })
    if (next) {
      emitLive("session.status", { sessionId: session.id, actor: null, data: { from: "chaos", to: "betting" } })
      return next
    }
  } else if (session.status === "betting" && expired(session.betting_ends_at)) {
    const { session: next } = await transitionSession(supabase, session.id, "betting", { status: "in_game" })
    if (next) {
      emitLive("session.status", { sessionId: session.id, actor: null, data: { from: "betting", to: "in_game" } })
      return next
    }
  } else {
    return session
  }

  const { session: latest } = await loadSession(supabase, session.id)
  return latest ?? session
}
