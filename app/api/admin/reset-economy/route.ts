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

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single()
  if (!player?.is_admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  // Ensure no active act exists
  const { data: activeAct } = await supabase
    .from("acts")
    .select("*")
    .eq("status", "active")
    .maybeSingle()

  if (activeAct) {
    return NextResponse.json(
      { error: "An active act already exists. Archive it first." },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const actName = body.name ?? "Act II: The Fallen Crown"
  const actSubtitle = body.subtitle ?? "The Fallen Crown"
  const initialGrant = body.initial_grant ?? 100

  // Get the next act number
  const { data: lastAct } = await supabase
    .from("acts")
    .select("act_number")
    .order("act_number", { ascending: false })
    .limit(1)
    .single()

  const nextActNumber = (lastAct?.act_number ?? 0) + 1

  // Create the new act
  const { data: newAct, error: actError } = await supabase
    .from("acts")
    .insert({
      act_number: nextActNumber,
      name: actName,
      subtitle: actSubtitle,
      status: "active",
      started_at: new Date().toISOString(),
      initial_grant: initialGrant,
    })
    .select()
    .single()

  if (actError) {
    return NextResponse.json({ error: actError.message }, { status: 500 })
  }

  // Get all existing balances
  const { data: balances } = await supabase
    .from("point_balances")
    .select("user_id")

  // Reset all balances to 0
  const { error: resetError } = await supabase
    .from("point_balances")
    .update({
      balance: 0,
      last_daily_claim: null,
      updated_at: new Date().toISOString(),
    })
    .not("user_id", "is", null)

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  // Apply initial grant to all existing users
  let grantedCount = 0
  for (const b of balances ?? []) {
    await supabase.rpc("adjust_balance", {
      p_user_id: b.user_id,
      p_amount: initialGrant,
      p_reason: "initial_grant",
    })
    grantedCount++
  }

  // Apply carry-over bonuses from the most recent archived act
  const { data: lastArchivedAct } = await supabase
    .from("acts")
    .select("id")
    .eq("status", "archived")
    .order("act_number", { ascending: false })
    .limit(1)
    .single()

  let carryOverCount = 0
  if (lastArchivedAct) {
    const { data: awards } = await supabase
      .from("act_awards")
      .select("user_id, carry_over_bonus, category")
      .eq("act_id", lastArchivedAct.id)
      .gt("carry_over_bonus", 0)

    const applied = new Set<string>()
    for (const award of awards ?? []) {
      if (applied.has(award.user_id)) continue
      applied.add(award.user_id)

      // Sum all carry-over bonuses for this user (they might win multiple categories)
      const totalBonus = (awards ?? [])
        .filter((a) => a.user_id === award.user_id)
        .reduce((sum, a) => sum + a.carry_over_bonus, 0)

      await supabase.rpc("adjust_balance", {
        p_user_id: award.user_id,
        p_amount: totalBonus,
        p_reason: "act_carryover",
      })
      carryOverCount++
    }
  }

  return NextResponse.json({
    message: `Act ${nextActNumber} started. ${grantedCount} users granted ${initialGrant} pts. ${carryOverCount} carry-over bonuses applied.`,
    act: newAct,
  })
}
