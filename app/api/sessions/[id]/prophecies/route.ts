import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const MULTIPLIERS: Record<string, number> = {
  player_gets_lane: 2.0,
  player_most_kills: 2.5,
  side_wins_fast: 3.0,
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: prophecies, error } = await supabase
    .from("prophecies")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = [...new Set((prophecies ?? []).map((p: { user_id: string }) => p.user_id))]

  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("user_profiles")
        .select("id, discord_username, discord_avatar_url")
        .in("id", userIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  )

  const enriched = (prophecies ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    discord_username: profileMap.get(p.user_id as string)?.discord_username ?? "Unknown",
    discord_avatar_url: profileMap.get(p.user_id as string)?.discord_avatar_url ?? null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { prediction_type, prediction_value } = body

  if (!prediction_type || !prediction_value) {
    return NextResponse.json(
      { error: "prediction_type and prediction_value required" },
      { status: 400 }
    )
  }

  if (!MULTIPLIERS[prediction_type]) {
    return NextResponse.json({ error: "Invalid prediction type" }, { status: 400 })
  }

  const { data: session } = await supabase
    .from("game_sessions")
    .select("status")
    .eq("id", id)
    .single()

  if (!session || session.status !== "betting") {
    return NextResponse.json(
      { error: "Prophecies can only be placed during betting" },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from("prophecies")
    .select("id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "You already placed a prophecy for this game" },
      { status: 400 }
    )
  }

  const { data: prophecy, error } = await supabase
    .from("prophecies")
    .insert({
      user_id: user.id,
      session_id: id,
      prediction_type,
      prediction_value,
      multiplier: MULTIPLIERS[prediction_type],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ placed: true, prophecy })
}
