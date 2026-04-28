import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { player_id } = (await request.json()) as { player_id: string }

  if (!player_id) {
    return NextResponse.json(
      { error: "player_id is required" },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from("players")
    .select("auth_user_id")
    .eq("id", player_id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: "Player not found" },
      { status: 404 }
    )
  }

  if (existing.auth_user_id && existing.auth_user_id !== user.id) {
    return NextResponse.json(
      { error: "Player already claimed by another user" },
      { status: 409 }
    )
  }

  const { error: playerError } = await supabase
    .from("players")
    .update({ auth_user_id: user.id })
    .eq("id", player_id)

  if (playerError) {
    return NextResponse.json(
      { error: playerError.message },
      { status: 500 }
    )
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ player_id })
    .eq("id", user.id)

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
