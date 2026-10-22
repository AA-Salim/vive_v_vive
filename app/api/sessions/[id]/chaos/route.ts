import { NextResponse } from "next/server"
import { getDecree } from "@/lib/chaos/catalog"
import { loadEntries } from "@/lib/chaos/entries"
import { CHAOS_ERRORS } from "@/lib/chaos/errors"
import { decreeTargetName } from "@/lib/chaos/format"
import { decreeRequestSchema, sessionIdSchema } from "@/lib/chaos/schema"
import { decreeTargetUserId, issueDecree, loadBoard } from "@/lib/chaos/server"
import type { ChaosDecreeEntry } from "@/lib/chaos/types"
import { migrationPending } from "@/lib/db-errors"
import { emitLive } from "@/lib/live/server"
import { createClient } from "@/lib/supabase"
import { isHerald, noteText } from "@/lib/titles/effects"
import { loadUserEffects } from "@/lib/titles/server"

const NO_STORE = { "Cache-Control": "no-store" }

type RouteContext = { params: Promise<{ id: string }> }

function failure(code: keyof typeof CHAOS_ERRORS) {
  const { status, message } = CHAOS_ERRORS[code]
  return NextResponse.json({ error: message, code }, { status, headers: NO_STORE })
}

function eventSide(entry: ChaosDecreeEntry) {
  return (
    entry.side ??
    entry.target_team ??
    entry.affected_side ??
    entry.details.changes?.[0]?.side ??
    entry.details.target?.side ??
    null
  )
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) return failure("session_not_found")
  const supabase = await createClient()
  const view = new URL(request.url).searchParams.get("view")
  try {
    const body = view === "board" ? await loadBoard(supabase, id) : await loadEntries(supabase, id)
    return NextResponse.json(body, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The royal decree ledger could not be read." }, { status: 500, headers: NO_STORE })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) return failure("session_not_found")
  const json: unknown = await request.json().catch(() => null)
  if (json && typeof json === "object" && (json as { action_type?: unknown }).action_type === "target_reroll") {
    return failure("retired_decree")
  }
  const parsed = decreeRequestSchema.safeParse(json)
  if (!parsed.success) return failure("unknown_decree")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return failure("not_authenticated")

  const outcome = await issueDecree(supabase, id, user.id, parsed.data)
  if (!outcome.ok) {
    if ("migration" in outcome) return migrationPending(outcome.migration)
    return failure(outcome.code)
  }

  const { response } = outcome
  const entry = response.decree
  const def = getDecree(entry.action_type)
  const [targetUserId, fx] = await Promise.all([decreeTargetUserId(supabase, entry), loadUserEffects(supabase, user.id)])
  const notes = response.titleEffects ?? []
  emitLive("chaos.decree", {
    sessionId: id,
    actor: { userId: user.id, name: entry.actor_name, avatarUrl: entry.discord_avatar_url },
    data: {
      decree: entry.action_type,
      label: def?.name ?? "A royal decree",
      cost: entry.cost,
      targetName: decreeTargetName(entry),
      side: eventSide(entry),
      targetUserId,
      tier: def?.tier,
      headline: response.headline,
      actionId: entry.id,
      affectedSide: entry.affected_side,
      changedAssignmentIds: response.changedAssignmentIds,
      changedPlayerIds: response.changedPlayerIds,
      titleEffects: notes.length ? notes.map(noteText) : undefined,
      herald: isHerald(fx) || undefined,
    },
  })

  return NextResponse.json(response, { headers: NO_STORE })
}
