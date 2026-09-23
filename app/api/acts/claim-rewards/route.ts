import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ awards: [] })
  }

  const { data: awards } = await supabase
    .from("act_awards")
    .select("*, acts:act_id (act_number, name)")
    .eq("user_id", user.id)

  if (!awards || awards.length === 0) {
    return NextResponse.json({ awards: [] })
  }

  const { data: claimedTxns } = await supabase
    .from("point_transactions")
    .select("reference_id")
    .eq("user_id", user.id)
    .eq("reason", "act_carryover")

  const claimedIds = new Set(
    (claimedTxns ?? []).map((t) => t.reference_id).filter(Boolean)
  )

  const unclaimed = awards.filter((a) => !claimedIds.has(a.id))

  return NextResponse.json({ awards: unclaimed })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { award_id } = body

  if (!award_id) {
    return NextResponse.json({ error: "award_id required" }, { status: 400 })
  }

  const { data: award } = await supabase
    .from("act_awards")
    .select("*, acts:act_id (act_number)")
    .eq("id", award_id)
    .eq("user_id", user.id)
    .single()

  if (!award) {
    return NextResponse.json({ error: "Award not found" }, { status: 404 })
  }

  const { data: alreadyClaimed } = await supabase
    .from("point_transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("reason", "act_carryover")
    .eq("reference_id", award.id)
    .maybeSingle()

  if (alreadyClaimed) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  }

  // Grant the title — find or create
  let { data: title } = await supabase
    .from("titles")
    .select("id")
    .eq("name", award.title)
    .maybeSingle()

  if (!title) {
    const { data: created } = await supabase
      .from("titles")
      .insert({
        name: award.title,
        description: `Awarded for ${award.category} in ${award.title.split(" ").slice(0, 2).join(" ")}`,
        price: 0,
        category: "award",
        for_self: true,
        is_permanent: true,
      })
      .select("id")
      .single()
    title = created
  }

  if (title) {
    const { data: existingUserTitle } = await supabase
      .from("user_titles")
      .select("id")
      .eq("user_id", user.id)
      .eq("title_id", title.id)
      .maybeSingle()

    if (!existingUserTitle) {
      await supabase.from("user_titles").insert({
        user_id: user.id,
        title_id: title.id,
        is_active: false,
      })
    }
  }

  // Apply carry-over bonus
  if (award.carry_over_bonus > 0) {
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: award.carry_over_bonus,
      p_reason: "act_carryover",
      p_reference_id: award.id,
    })
  } else {
    // Still insert a 0-amount marker so we know it's claimed
    await supabase.from("point_transactions").insert({
      user_id: user.id,
      amount: 0,
      reason: "act_carryover",
      reference_id: award.id,
    })
  }

  return NextResponse.json({
    claimed: true,
    title: award.title,
    bonus: award.carry_over_bonus,
  })
}
