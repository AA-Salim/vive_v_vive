import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const SESSION_SELECT = `
  *,
  session_assignments (
    *,
    players:player_id ( id, name )
  )
`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { blue_coach_id, red_coach_id } = await request.json()

  if (!blue_coach_id || !red_coach_id) {
    return NextResponse.json(
      { error: "Both blue_coach_id and red_coach_id are required" },
      { status: 400 }
    )
  }

  if (blue_coach_id === red_coach_id) {
    return NextResponse.json(
      { error: "Coaches must be different users" },
      { status: 400 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Login required" },
      { status: 401 }
    )
  }

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      status: "coach_draft",
      game_mode: "coach_draft",
      created_by: user.id,
      blue_coach_id,
      red_coach_id,
      draft_turn: "blue",
    })
    .select(SESSION_SELECT)
    .single()

  if (sessionError) {
    if (sessionError.code === "23505") {
      return NextResponse.json(
        { error: "An active session already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: sessionError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(session, { status: 201 })
}
