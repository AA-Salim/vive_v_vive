import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { CONSOLATION_PREFIX, claimAward, claimConsolation, listClaimable } from "@/lib/lore/reward-claims"

const NO_STORE = { "Cache-Control": "no-store" }

const claimSchema = z.object({
  award_id: z.union([z.uuid(), z.string().regex(/^consolation-\d{1,9}$/)]),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ awards: [] }, { headers: NO_STORE })

  const awards = await listClaimable(supabase, user.id)
  if (!awards) return NextResponse.json({ error: "The archive is closed for now." }, { status: 500, headers: NO_STORE })
  return NextResponse.json({ awards }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "award_id required" }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const awardId = parsed.data.award_id
  const result = awardId.startsWith(CONSOLATION_PREFIX)
    ? await claimConsolation(supabase, user.id, awardId)
    : await claimAward(supabase, user.id, awardId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  emitLive("title.claimed", { actor: await getActor(supabase, user.id), data: { titles: [result.title] } })
  if (result.bonus > 0) {
    emitLive("points.changed", {
      actor: null,
      data: { userId: user.id, delta: result.bonus, reason: "act_carryover" },
      persist: false,
    })
  }

  return NextResponse.json({
    claimed: true,
    title: result.title,
    bonus: result.bonus,
    consolation: result.consolation,
  })
}
