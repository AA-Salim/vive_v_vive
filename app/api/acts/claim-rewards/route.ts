import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const CONSOLATION_TITLES = [
  "Salaxe's Background Character",
  "Court Jester (Unpaid)",
  "Throne Room Tourist",
  "The One Who Was There",
  "Salaxe's Tax Write-Off",
  "Professional Bystander",
  "Royal Seat Warmer",
  "The Forgettable",
  "Act I Survivor (Barely)",
  "Salaxe's Emotional Baggage",
  "Crown Witness (Did Not Touch It)",
  "The NPC",
  "Vive v Vive Benchwarmer",
  "Salaxe's Least Favorite",
  "The One Who Showed Up",
  "Royal Court Filler",
  "Act I: Participated",
  "Charamil's Most Average",
  "Almost Relevant",
  "Salaxe's Forgotten Minion",
]

function hashToIndex(str: string, max: number): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % max
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
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

  const { data: awards } = await supabase
    .from("act_awards")
    .select("*, acts:act_id (act_number, name)")
    .eq("user_id", user.id)

  const unclaimed = (awards ?? []).filter((a) => !claimedIds.has(a.id))

  if (unclaimed.length > 0) {
    return NextResponse.json({ awards: unclaimed })
  }

  const { data: snapshots } = await supabase
    .from("act_snapshots")
    .select("act_id, acts:act_id (id, act_number, name, status)")
    .eq("user_id", user.id)

  const consolationAwards = []
  for (const snap of snapshots ?? []) {
    const act = snap.acts as unknown as { id: string; act_number: number; name: string; status: string } | null
    if (!act || act.status !== "archived") continue

    const consolationRef = `consolation-${act.id}`
    if (claimedIds.has(consolationRef)) continue
    if ((awards ?? []).some((a) => a.act_id === act.id)) continue

    const titleIndex = hashToIndex(user.id + act.id, CONSOLATION_TITLES.length)
    consolationAwards.push({
      id: consolationRef,
      category: "consolation",
      title: CONSOLATION_TITLES[titleIndex],
      carry_over_bonus: 0,
      final_value: null,
      perks: {},
      acts: { act_number: act.act_number, name: act.name },
      is_consolation: true,
    })
  }

  return NextResponse.json({ awards: consolationAwards })
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

  if (typeof award_id === "string" && award_id.startsWith("consolation-")) {
    return handleConsolationClaim(supabase, user.id, award_id)
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

  if (award.carry_over_bonus > 0) {
    await supabase.rpc("adjust_balance", {
      p_user_id: user.id,
      p_amount: award.carry_over_bonus,
      p_reason: "act_carryover",
      p_reference_id: award.id,
    })
  } else {
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

async function handleConsolationClaim(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  consolationRef: string,
) {
  const actId = consolationRef.replace("consolation-", "")

  const { data: alreadyClaimed } = await supabase
    .from("point_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "act_carryover")
    .eq("reference_id", consolationRef)
    .maybeSingle()

  if (alreadyClaimed) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  }

  const { data: snapshot } = await supabase
    .from("act_snapshots")
    .select("act_id")
    .eq("user_id", userId)
    .eq("act_id", actId)
    .maybeSingle()

  if (!snapshot) {
    return NextResponse.json({ error: "Not eligible" }, { status: 403 })
  }

  const titleIndex = hashToIndex(userId + actId, CONSOLATION_TITLES.length)
  const titleName = CONSOLATION_TITLES[titleIndex]

  let { data: title } = await supabase
    .from("titles")
    .select("id")
    .eq("name", titleName)
    .maybeSingle()

  if (!title) {
    const { data: created } = await supabase
      .from("titles")
      .insert({
        name: titleName,
        description: "A participation trophy from Act I",
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
      .eq("user_id", userId)
      .eq("title_id", title.id)
      .maybeSingle()

    if (!existingUserTitle) {
      await supabase.from("user_titles").insert({
        user_id: userId,
        title_id: title.id,
        is_active: false,
      })
    }
  }

  await supabase.from("point_transactions").insert({
    user_id: userId,
    amount: 0,
    reason: "act_carryover",
    reference_id: consolationRef,
  })

  return NextResponse.json({
    claimed: true,
    title: titleName,
    bonus: 0,
  })
}
