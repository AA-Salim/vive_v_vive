import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { loadProphecyBoard } from "@/lib/prophecy/board"
import { PROPHECY_FEATURE } from "@/lib/prophecy/constants"
import { sealLabel } from "@/lib/prophecy/lines"
import { isLegacyProphecyBody, sealProphecySchema, sessionIdSchema } from "@/lib/prophecy/schemas"
import { loadProfiles, playerName, rpcErrorResponse, toWagerView, type WagerRow } from "@/lib/prophecy/server"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!sessionIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }

  const supabase = await createClient()
  try {
    const board = await loadProphecyBoard(supabase, id)
    if (!board) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    return NextResponse.json(board, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The Oracle is unreachable right now." }, { status: 500 })
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
  if (!user) return NextResponse.json({ error: "Log in with Discord to seal a prophecy." }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  if (isLegacyProphecyBody(body)) {
    return NextResponse.json(
      { error: "Lane Calls are retired. Refresh the page to seal an MVP or Inter prophecy.", code: "legacy_prophecy" },
      { status: 410 }
    )
  }

  const parsed = sealProphecySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick MVP or Inter, a player, and a stake from 10 to 50." }, { status: 400 })
  }

  const { market, playerId, stake } = parsed.data
  const { data, error } = await supabase.rpc("seal_prophecy", {
    p_session_id: id,
    p_market: market,
    p_player_id: playerId,
    p_stake: stake,
  })

  if (error) {
    if (isMissingSchema(error)) return migrationPending(PROPHECY_FEATURE)
    return rpcErrorResponse(error, "The Oracle fumbled your prophecy. Try again.")
  }

  const [actor, name, profiles] = await Promise.all([
    getActor(supabase, user.id),
    playerName(supabase, playerId),
    loadProfiles(supabase, [user.id]),
  ])
  emitLive("sidebet.placed", { sessionId: id, actor, data: { market, label: sealLabel(market, name), amount: stake } })

  return NextResponse.json({ placed: true, wager: toWagerView(data as WagerRow, profiles) }, { status: 201 })
}
