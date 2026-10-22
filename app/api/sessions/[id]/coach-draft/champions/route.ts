import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { getActor } from "@/lib/live/server"
import { ChampionDraftActionSchema } from "@/lib/lobby/champion-pick"
import {
  announceChampionPick,
  announceChampionRequest,
  announceChampionUndo,
  loadChampionDraft,
  pickChampion,
  requestChampion,
  tickChampionSelect,
  undoChampion,
} from "@/lib/lobby/server/coach-champions"
import { draftError } from "@/lib/lobby/server/coach-draft"
import type { CoachDraftErrorCode } from "@/lib/lobby/server/coach-errors"
import { AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"

type Params = { params: Promise<{ id: string }> }

const IdSchema = z.guid()

function rejected(outcome: { code: CoachDraftErrorCode | "server"; message?: string }) {
  const { status, error, code } = draftError(outcome.code, outcome.message)
  return fail(status, error, code)
}

// The clock is lazy: whoever reads (or acts) past a deadline lands that pick's auto-pick, once.
async function settleClock(supabase: SupabaseClient, sessionId: string) {
  const auto = await tickChampionSelect(supabase, sessionId)
  if (auto) announceChampionPick(sessionId, null, auto)
}

async function board(supabase: SupabaseClient, sessionId: string) {
  const { view, error } = await loadChampionDraft(supabase, sessionId)
  if (error) return fail(500, "The champion board is unreadable right now.")
  if (!view) return fail(404, "This draft no longer exists.")
  return ok(view)
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "This draft no longer exists.")
  const supabase = await createClient()
  await settleClock(supabase, id)
  return board(supabase, id)
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "This draft no longer exists.")
  const parsed = ChampionDraftActionSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error, "Unknown champion select action")
  const action = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return AUTH_REQUIRED()
  const actor = await getActor(supabase, user.id)

  switch (action.action) {
    case "pick": {
      const outcome = await pickChampion(supabase, id, { playerId: action.player_id, champion: action.champion, pickNumber: action.pick_number })
      if (!outcome.ok) {
        if (outcome.code === "turn_expired") await settleClock(supabase, id)
        return rejected(outcome)
      }
      if (!outcome.value.replayed) announceChampionPick(id, actor, outcome.value)
      break
    }
    case "undo": {
      const outcome = await undoChampion(supabase, id)
      if (!outcome.ok) {
        if (outcome.code === "turn_expired") await settleClock(supabase, id)
        return rejected(outcome)
      }
      announceChampionUndo(id, actor, outcome.value)
      break
    }
    case "request": {
      const outcome = await requestChampion(supabase, id, action.champion)
      if (!outcome.ok) return rejected(outcome)
      announceChampionRequest(id, actor, outcome.value)
      break
    }
  }

  return board(supabase, id)
}
