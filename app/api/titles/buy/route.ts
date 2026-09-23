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
  const { title_id, target_user_id } = body

  if (!title_id) {
    return NextResponse.json({ error: "title_id required" }, { status: 400 })
  }

  const { data: title } = await supabase
    .from("titles")
    .select("*")
    .eq("id", title_id)
    .single()

  if (!title) {
    return NextResponse.json({ error: "Title not found" }, { status: 404 })
  }

  if (title.category === "award") {
    return NextResponse.json(
      { error: "Award titles cannot be purchased" },
      { status: 400 }
    )
  }

  const recipientId = title.for_self ? user.id : target_user_id
  if (!recipientId) {
    return NextResponse.json(
      { error: "target_user_id required for mockery titles" },
      { status: 400 }
    )
  }

  if (!title.for_self && recipientId === user.id) {
    return NextResponse.json(
      { error: "Cannot assign a mockery title to yourself" },
      { status: 400 }
    )
  }

  // Check if already owned
  const { data: existing } = await supabase
    .from("user_titles")
    .select("id")
    .eq("user_id", recipientId)
    .eq("title_id", title_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: title.for_self ? "You already own this title" : "They already have this title" },
      { status: 400 }
    )
  }

  // Deduct points
  const { error: balanceError } = await supabase.rpc("adjust_balance", {
    p_user_id: user.id,
    p_amount: -title.price,
    p_reason: "title_bought",
  })

  if (balanceError) {
    return NextResponse.json(
      { error: balanceError.message },
      { status: 400 }
    )
  }

  // Assign title
  const { error: insertError } = await supabase.from("user_titles").insert({
    user_id: recipientId,
    title_id: title_id,
    assigned_by: title.for_self ? null : user.id,
    is_active: false,
  })

  if (insertError) {
    // Refund on failure
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: title.price,
      p_reason: "title_bought",
    })
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ purchased: true, title: title.name })
}
