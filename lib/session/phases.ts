import type { SupabaseClient } from "@supabase/supabase-js"
import { getChampionPools } from "@/lib/champions-db"
import { assignChampions } from "@/lib/randomizer"
import type { Assignment, Player, Role, SessionStatus, Side } from "@/lib/types"
import { BETTING_DURATION_MS, CHAOS_DURATION_MS } from "@/lib/session/constants"
import { fail, loadSession, transitionSession, type ActionOutcome, type SessionRow } from "@/lib/session/server"

const PHASE_ORDER: SessionStatus[] = ["coach_draft", "draft", "chaos", "betting", "in_game", "blue_win", "red_win", "canceled", "expired"]

function isPast(status: SessionStatus, phase: SessionStatus) {
  return PHASE_ORDER.indexOf(status) > PHASE_ORDER.indexOf(phase)
}

async function settle(supabase: SupabaseClient, sessionId: string, moved: SessionRow | null, error: { message?: string } | null) {
  if (error) return fail(500, error.message ?? "Could not update the game")
  if (moved) return { ok: true, session: moved, changed: true } satisfies ActionOutcome
  const { session } = await loadSession(supabase, sessionId)
  if (!session) return fail(404, "Session not found")
  return { ok: true, session, changed: false } satisfies ActionOutcome
}

export async function startGame(supabase: SupabaseClient, session: SessionRow): Promise<ActionOutcome> {
  if (session.status !== "draft") {
    if (isPast(session.status, "draft")) return { ok: true, session, changed: false }
    return fail(409, "The draft is not finished yet.", "wrong_phase")
  }
  const { session: moved, error } = await transitionSession(supabase, session.id, "draft", {
    status: "chaos",
    chaos_ends_at: new Date(Date.now() + CHAOS_DURATION_MS).toISOString(),
  })
  return settle(supabase, session.id, moved, error)
}

// Hosts may close a timed phase early; anyone else only once the server clock has passed the deadline.
export async function closeTimedPhase(
  supabase: SupabaseClient,
  session: SessionRow,
  phase: "chaos" | "betting",
  canForce: boolean
): Promise<ActionOutcome> {
  if (session.status !== phase) {
    if (isPast(session.status, phase)) return { ok: true, session, changed: false }
    return fail(409, phase === "chaos" ? "Decrees are not open." : "Betting is not open.", "wrong_phase")
  }
  const endsAt = phase === "chaos" ? session.chaos_ends_at : session.betting_ends_at
  const remaining = endsAt ? Date.parse(endsAt) - Date.now() : 0
  if (!canForce && remaining > 0) {
    return fail(409, `The timer still has ${Math.ceil(remaining / 1000)}s on it.`, "timer_running")
  }
  const patch =
    phase === "chaos"
      ? { status: "betting", betting_ends_at: new Date(Date.now() + BETTING_DURATION_MS).toISOString() }
      : { status: "in_game" }
  const { session: moved, error } = await transitionSession(supabase, session.id, phase, patch)
  return settle(supabase, session.id, moved, error)
}

function toPlayer(a: SessionRow["session_assignments"][number]): Player {
  return { id: a.players.id, name: a.players.name, is_active: true, wins: 0, losses: 0, games_played: 0, created_at: "" }
}

export async function todaysFearless(supabase: SupabaseClient): Promise<Set<string>> {
  const today = new Date().toISOString().split("T")[0]
  const { data } = await supabase.from("daily_fearless").select("champion_name").eq("date", today)
  return new Set((data ?? []).map((r: { champion_name: string }) => r.champion_name))
}

// Rewrites unlocked rows in place: assignment ids stay stable and the board never has missing slots.
export async function rerollDraft(supabase: SupabaseClient, session: SessionRow): Promise<ActionOutcome> {
  if (session.status !== "draft") return fail(409, "Re-rolls only happen during the draft.", "wrong_phase")

  const { data: claimed, error: claimError } = await supabase
    .from("game_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "draft")
    .eq("updated_at", session.updated_at)
    .select("id")
    .maybeSingle()
  if (claimError) return fail(500, claimError.message)
  if (!claimed) return fail(409, "The draft just changed. Try again.", "stale")

  const [fearless, pools] = await Promise.all([todaysFearless(supabase), getChampionPools()])
  const rows = session.session_assignments
  const locked = new Map<string, Assignment>()
  for (const a of rows) {
    if (!a.locked) continue
    locked.set(a.player_id, {
      player: toPlayer(a),
      side: a.side,
      lane: a.lane,
      champion: a.champion,
      championInternal: a.champion_internal,
      locked: true,
      fearlessOverride: a.fearless_override,
    })
  }
  const team = (side: Side) =>
    rows.filter((a) => a.side === side).map((a) => ({ player: toPlayer(a), lane: a.lane as Role }))
  const next = assignChampions(team("blue"), team("red"), fearless, locked, pools)
  const byPlayer = new Map(next.map((a) => [a.player.id, a]))

  const results = await Promise.all(
    rows
      .filter((a) => !a.locked)
      .map((a) => {
        const pick = byPlayer.get(a.player_id)
        if (!pick) return Promise.resolve({ error: null })
        return supabase
          .from("session_assignments")
          .update({ champion: pick.champion, champion_internal: pick.championInternal, fearless_override: pick.fearlessOverride })
          .eq("id", a.id)
          .eq("locked", false)
      })
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return fail(500, failed.error.message ?? "Could not re-roll the draft")

  const { session: fresh } = await loadSession(supabase, session.id)
  return fresh ? { ok: true, session: fresh, changed: true } : fail(404, "Session not found")
}

export async function toggleLock(supabase: SupabaseClient, session: SessionRow, assignmentId: string): Promise<ActionOutcome> {
  if (session.status !== "draft") return fail(409, "Locks only change during the draft.", "wrong_phase")
  const target = session.session_assignments.find((a) => a.id === assignmentId)
  if (!target) return fail(404, "That player is not in this game.")

  const { data, error } = await supabase
    .from("session_assignments")
    .update({ locked: !target.locked })
    .eq("id", target.id)
    .eq("session_id", session.id)
    .eq("locked", target.locked)
    .select("id")
    .maybeSingle()
  if (error) return fail(500, error.message)
  if (!data) return fail(409, "That lock just changed. Try again.", "stale")

  const { session: fresh } = await loadSession(supabase, session.id)
  return fresh ? { ok: true, session: fresh, changed: true } : fail(404, "Session not found")
}
