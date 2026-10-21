import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { getViewer } from "@/lib/session/server"

const deleteSchema = z.object({ champion: z.string().trim().min(1).max(64).optional() })

function today() {
  return new Date().toISOString().split("T")[0]
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("daily_fearless").select("champion_name").eq("date", today())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((row) => row.champion_name as string), {
    headers: { "cache-control": "no-store" },
  })
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid champion" }, { status: 400 })
  const { champion } = parsed.data

  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  if (!viewer.user) return NextResponse.json({ error: "Sign in with Discord first.", code: "auth_required" }, { status: 401 })
  if (!champion && !viewer.isAdmin) {
    return NextResponse.json({ error: "Only admins can wipe the fearless list.", code: "forbidden" }, { status: 403 })
  }

  let query = supabase.from("daily_fearless").delete().eq("date", today())
  if (champion) query = query.eq("champion_name", champion)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  emitLive("fearless.changed", {
    actor: await getActor(supabase, viewer.user.id),
    data: champion ? { action: "removed", champion } : { action: "cleared", champion: null },
  })
  return NextResponse.json(champion ? { removed: champion } : { cleared: true })
}
