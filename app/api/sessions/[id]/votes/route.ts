import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { TRIBUNAL_FEATURE } from "@/lib/prophecy/constants"
import { castVoteSchema, sessionIdSchema } from "@/lib/prophecy/schemas"
import { rpcErrorResponse } from "@/lib/prophecy/server"
import { loadTribunalState } from "@/lib/prophecy/tribunal"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }

  const supabase = await createClient()
  try {
    const state = await loadTribunalState(supabase, id)
    if (!state) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    return NextResponse.json(state, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The tribunal could not be reached." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Log in with Discord to vote." }, { status: 401 })

  const parsed = castVoteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick MVP or Inter and a player from this game." }, { status: 400 })
  }

  const { category, playerId } = parsed.data
  const { error } = await supabase.rpc("cast_post_game_vote", {
    p_session_id: id,
    p_category: category,
    p_player_id: playerId,
  })

  if (error) {
    if (isMissingSchema(error)) return migrationPending(TRIBUNAL_FEATURE)
    return rpcErrorResponse(error, "Your ballot got lost on the way to the court. Try again.")
  }

  emitLive("vote.cast", { sessionId: id, actor: await getActor(supabase, user.id), data: { category } })
  return NextResponse.json({ ok: true, category, playerId })
}
