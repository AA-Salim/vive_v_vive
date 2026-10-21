import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { MILESTONES, type MilestoneDefinition } from "@/lib/milestones"
import { perkInfo, rarityOf } from "@/lib/titles/catalog"
import { titleError } from "@/lib/titles/errors"
import { computeMilestoneStats, type MilestoneStats } from "@/lib/titles/milestone-stats"
import type { MilestoneView } from "@/lib/titles/types"

type Supabase = Awaited<ReturnType<typeof createClient>>

const Body = z.union([z.object({ milestone_id: z.string().min(1).max(64) }), z.object({ all: z.literal(true) })])

async function ownedTitleNames(supabase: Supabase, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_titles").select("titles ( name )").eq("user_id", userId)
  return new Set(
    (data ?? []).flatMap((row) => {
      const joined = row.titles as { name: string } | { name: string }[] | null
      const t = Array.isArray(joined) ? joined[0] : joined
      return t ? [t.name] : []
    })
  )
}

function viewOf(m: MilestoneDefinition, stats: MilestoneStats, owned: Set<string>): MilestoneView {
  const current = stats[m.stat] ?? 0
  return {
    ...m,
    current: Math.floor(current * 100) / 100,
    unlocked: current >= m.threshold,
    claimed: owned.has(m.title),
    perk: perkInfo(m.title, "award"),
    rarity: rarityOf(m.title, "award"),
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const [stats, owned] = await Promise.all([computeMilestoneStats(supabase, user.id), ownedTitleNames(supabase, user.id)])
  return NextResponse.json({ milestones: MILESTONES.map((m) => viewOf(m, stats, owned)), stats })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "milestone_id or all is required" }, { status: 400 })

  const [stats, owned] = await Promise.all([computeMilestoneStats(supabase, user.id), ownedTitleNames(supabase, user.id)])
  const views = MILESTONES.map((m) => viewOf(m, stats, owned))

  let targets: MilestoneView[]
  if ("milestone_id" in parsed.data) {
    const target = views.find((m) => m.id === (parsed.data as { milestone_id: string }).milestone_id)
    if (!target) return NextResponse.json({ error: "Unknown milestone" }, { status: 404 })
    if (target.claimed) return NextResponse.json({ error: "Already claimed" }, { status: 400 })
    if (!target.unlocked) return NextResponse.json({ error: "Milestone not reached yet. Keep grinding." }, { status: 400 })
    targets = [target]
  } else {
    targets = views.filter((m) => m.unlocked && !m.claimed)
    if (targets.length === 0) return NextResponse.json({ error: "Nothing left to claim" }, { status: 400 })
  }

  const claimed: string[] = []
  for (const milestone of targets) {
    if (await grantMilestoneTitle(supabase, user.id, milestone)) claimed.push(milestone.title)
  }
  if (claimed.length === 0) return NextResponse.json({ error: "Could not engrave the title. Try again." }, { status: 500 })

  emitLive("title.claimed", { actor: await getActor(supabase, user.id), data: { titles: claimed } })
  return NextResponse.json({ claimed: true, title: claimed[0], titles: claimed })
}

async function grantMilestoneTitle(supabase: Supabase, userId: string, milestone: MilestoneDefinition): Promise<boolean> {
  const find = () => supabase.from("titles").select("id").eq("name", milestone.title).maybeSingle()
  let { data: title } = await find()
  if (!title) {
    await supabase.from("titles").insert({
      name: milestone.title,
      description: milestone.description,
      price: 0,
      category: "award",
      for_self: true,
      is_permanent: true,
    })
    ;({ data: title } = await find())
  }
  if (!title) return false

  const { error } = await supabase.from("user_titles").insert({ user_id: userId, title_id: title.id, is_active: false })
  return !error || error.code === "23505"
}
