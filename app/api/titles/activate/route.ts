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

  const body = await request.json()
  const { title_id } = body

  // Deactivate all current titles
  await supabase
    .from("user_titles")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (title_id) {
    // Verify ownership
    const { data: owned } = await supabase
      .from("user_titles")
      .select("id")
      .eq("user_id", user.id)
      .eq("title_id", title_id)
      .single()

    if (!owned) {
      return NextResponse.json(
        { error: "You don't own this title" },
        { status: 400 }
      )
    }

    await supabase
      .from("user_titles")
      .update({ is_active: true })
      .eq("user_id", user.id)
      .eq("title_id", title_id)
  }

  return NextResponse.json({ activated: true })
}
