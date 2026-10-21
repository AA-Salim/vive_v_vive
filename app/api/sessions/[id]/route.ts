import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import type { LiveActor } from "@/lib/live/events"
import { winnerOf } from "@/lib/session/constants"
import { closeTimedPhase, rerollDraft, startGame, toggleLock } from "@/lib/session/phases"
import { cancelSession, declareWinner } from "@/lib/session/resolve"
import {
  canControlSession,
  errorResponse,
  type ActionOutcome,
  getViewer,
  loadSession,
  presentSession,
  sessionResponse,
  type SessionRow,
} from "@/lib/session/server"
import { sessionActionSchema, sessionIdSchema, type SessionAction } from "@/lib/session/types"

export const maxDuration = 60

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) return errorResponse(404, "Session not found")
  const supabase = await createClient()
  const { session, error } = await loadSession(supabase, id)
  if (error) return errorResponse(500, error.message ?? "Could not load the game")
  if (!session) return errorResponse(404, "Session not found")
  return sessionResponse(await presentSession(supabase, session))
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) return errorResponse(404, "Session not found")
  const parsed = sessionActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(400, "Unknown or malformed action")
  const action = parsed.data

  const supabase = await createClient()
  const [{ session, error }, viewer] = await Promise.all([loadSession(supabase, id), getViewer(supabase)])
  if (error) return errorResponse(500, error.message ?? "Could not load the game")
  if (!session) return errorResponse(404, "Session not found")
  if (!viewer.user) return errorResponse(401, "Sign in with Discord first.", "auth_required")

  const isHost = canControlSession(viewer, session)
  const timerAction = action.action === "close_chaos" || action.action === "close_betting"
  if (!isHost && !timerAction) {
    return errorResponse(403, "Only the host or an admin can do that.", "forbidden")
  }

  const outcome = await runAction(supabase, session, action, viewer, isHost)
  if (!outcome.ok) return errorResponse(outcome.status, outcome.error, outcome.code)

  if (outcome.changed) emitForAction(action, session, outcome.session, await getActor(supabase, viewer.user.id))
  return sessionResponse(await presentSession(supabase, outcome.session))
}

function runAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: SessionRow,
  action: SessionAction,
  viewer: Awaited<ReturnType<typeof getViewer>>,
  isHost: boolean
): Promise<ActionOutcome> {
  switch (action.action) {
    case "reroll":
      return rerollDraft(supabase, session)
    case "toggle_lock":
      return toggleLock(supabase, session, action.assignment_id)
    case "start_game":
      return startGame(supabase, session)
    case "close_chaos":
      return closeTimedPhase(supabase, session, "chaos", isHost)
    case "close_betting":
      return closeTimedPhase(supabase, session, "betting", isHost)
    case "declare_winner":
      return declareWinner(supabase, session, viewer, action.winner_side)
    case "cancel":
      return cancelSession(supabase, session, viewer)
  }
}

function emitForAction(action: SessionAction, before: SessionRow, after: SessionRow, actor: LiveActor | null) {
  const sessionId = before.id
  switch (action.action) {
    case "reroll":
      emitLive("session.rerolled", {
        sessionId,
        actor,
        data: { lockedCount: after.session_assignments.filter((a) => a.locked).length },
      })
      return
    case "toggle_lock": {
      const target = after.session_assignments.find((a) => a.id === action.assignment_id)
      if (target) emitLive("session.lock", { sessionId, actor, data: { playerName: target.players.name, locked: target.locked } })
      return
    }
    default:
      if (after.status !== before.status) {
        emitLive("session.status", {
          sessionId,
          actor,
          data: { from: before.status, to: after.status, winner: winnerOf(after.status) },
        })
      }
  }
}
