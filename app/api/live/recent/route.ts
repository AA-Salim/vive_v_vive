import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { rowToLiveEvent, type ActivityEventRow, type LiveEvent } from "@/lib/live/events"

const querySchema = z.object({
  sessionId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
})

const NO_STORE = { "Cache-Control": "no-store" }

// Recent persisted live events, newest first. With a sessionId: that game's events plus global ones.
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse({
    sessionId: params.sessionId || undefined,
    limit: params.limit || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }
  const { sessionId, limit } = parsed.data

  const supabase = await createClient()
  let query = supabase
    .from("activity_events")
    .select("id, type, session_id, actor, data, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (sessionId) query = query.or(`session_id.eq.${sessionId},session_id.is.null`)

  const { data, error } = await query
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json([], { headers: NO_STORE })
    return NextResponse.json({ error: "Could not load recent activity" }, { status: 500, headers: NO_STORE })
  }

  const events = ((data ?? []) as ActivityEventRow[])
    .map((row) => rowToLiveEvent(row))
    .filter((event): event is LiveEvent => event !== null)
  return NextResponse.json(events, { headers: NO_STORE })
}
