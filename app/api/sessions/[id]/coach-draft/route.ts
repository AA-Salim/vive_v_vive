import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { announceTeamsLocked } from "@/lib/lobby/server/coach-champions"
import { confirmDraft } from "@/lib/lobby/server/coach-confirm"
import {
  assignLane,
  autoAssignLanes,
  coachOf,
  draftError,
  loadDraft,
  pickPlayer,
  undoPick,
  type DraftOutcome,
} from "@/lib/lobby/server/coach-draft"
import { AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"
import { getLobbyViewer } from "@/lib/lobby/server/viewer"
import { CoachDraftActionSchema, type CoachDraftPickView } from "@/lib/lobby/types"
import { presentSession } from "@/lib/session/server"
import type { Side } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

const IdSchema = z.guid()

async function loadPicks(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from("coach_draft_picks")
    .select("*, players:player_id ( id, name )")
    .eq("session_id", sessionId)
    .order("pick_number", { ascending: true })
  return { picks: (data ?? []) as CoachDraftPickView[], error }
}

function rejected(outcome: Extract<DraftOutcome<unknown>, { ok: false }>) {
  const { status, error, code } = draftError(outcome.code, outcome.message)
  return fail(status, error, code)
}

const other = (side: Side): Side => (side === "blue" ? "red" : "blue")

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "This draft no longer exists.")
  const supabase = await createClient()
  const { picks, error } = await loadPicks(supabase, id)
  if (error) return fail(500, "The draft board is unreadable right now.")
  return ok(picks)
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "This draft no longer exists.")
  const parsed = CoachDraftActionSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error, "Unknown draft action")
  const action = parsed.data

  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()

  const { draft, error } = await loadDraft(supabase, id)
  if (error) return fail(500, "The draft board is unreadable right now.")
  if (!draft) return fail(404, "This draft no longer exists.")
  const { session } = draft
  const actor = await getActor(supabase, viewer.userId)
  const coachName = actor?.name ?? "A coach"

  switch (action.action) {
    case "pick": {
      const outcome = await pickPlayer(supabase, viewer, draft, action.player_id)
      if (!outcome.ok) return rejected(outcome)
      const pick = outcome.value
      const nextCoach = pick.nextSide ? coachOf(session, pick.nextSide) : null
      emitLive("coachdraft.pick", {
        sessionId: id,
        actor,
        data: {
          coachName,
          playerName: pick.playerName,
          side: pick.side,
          pickNumber: pick.pickNumber,
          nextSide: pick.nextSide,
          targetUserId: nextCoach && nextCoach !== viewer.userId ? nextCoach : null,
          playerUserId: pick.playerUserId,
        },
      })
      break
    }

    case "undo": {
      const outcome = await undoPick(supabase, draft)
      if (!outcome.ok) return rejected(outcome)
      const undone = outcome.value
      emitLive("coachdraft.undo", {
        sessionId: id,
        actor,
        data: {
          coachName,
          playerName: undone.playerName,
          side: undone.side,
          pickNumber: undone.pickNumber,
          targetUserId: coachOf(session, other(undone.side)),
        },
      })
      break
    }

    case "assign_lane":
    case "auto_lanes": {
      const outcome =
        action.action === "assign_lane"
          ? await assignLane(supabase, viewer, draft, action.player_id, action.lane)
          : await autoAssignLanes(supabase, viewer, draft)
      if (!outcome.ok) return rejected(outcome)
      const changed = outcome.value.flatMap((c) => (c.lane ? [{ playerId: c.playerId, lane: c.lane }] : []))
      if (changed.length > 0) {
        const { picks } = await loadPicks(supabase, id)
        const nameOf = (playerId: string) => picks.find((p) => p.player_id === playerId)?.players?.name ?? "A player"
        const side = picks.find((p) => p.player_id === changed[0].playerId)?.side ?? "blue"
        emitLive("coachdraft.lanes", {
          sessionId: id,
          actor,
          data: { coachName, side, lanes: changed.map((c) => ({ playerName: nameOf(c.playerId), lane: c.lane })) },
          persist: false,
        })
        return ok(picks)
      }
      break
    }

    case "confirm": {
      const outcome = await confirmDraft(supabase, viewer, draft)
      if (!outcome.ok) return rejected(outcome)
      if (outcome.value.championSelect) {
        announceTeamsLocked(id, actor, outcome.value.championSelect)
      } else if (outcome.value.changed) {
        emitLive("session.status", { sessionId: id, actor, data: { from: "coach_draft", to: "draft", winner: null } })
        if (outcome.value.dequeued > 0) {
          emitLive("queue.changed", { actor, data: { action: "advanced", count: outcome.value.dequeued }, persist: false })
        }
      }
      return ok(await presentSession(supabase, outcome.value.session))
    }
  }

  const { picks } = await loadPicks(supabase, id)
  return ok(picks)
}
