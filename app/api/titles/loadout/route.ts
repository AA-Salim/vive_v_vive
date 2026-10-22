import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { isCurseCategory, perkInfo, tierOf } from "@/lib/titles/catalog"
import { combineEffects, comboLines } from "@/lib/titles/effects"
import { MAX_EQUIPPED, primaryOf } from "@/lib/titles/loadout"
import { titleError, titleErrorKey } from "@/lib/titles/errors"

const Body = z.object({ title_ids: z.array(z.guid()).max(MAX_EQUIPPED) })

type Supabase = Awaited<ReturnType<typeof createClient>>

interface WornTitle {
  id: string
  name: string
  category: string
  price: number
  for_self: boolean
}

async function loadWorn(supabase: Supabase, userId: string): Promise<WornTitle[]> {
  const { data } = await supabase
    .from("user_titles")
    .select("title_id, titles ( id, name, category, price, for_self )")
    .eq("user_id", userId)
    .eq("is_active", true)
  return (data ?? []).flatMap((row) => {
    const joined = row.titles as unknown
    const t = (Array.isArray(joined) ? joined[0] : joined) as WornTitle | null
    return t ? [t] : []
  })
}

// Replaces the caller's whole loadout. Validated by equip_loadout() (supabase/phase10_title-effects.sql): slots per
// tier, conflicting pairs, sealed while a game is live. Before that migration only a single title can be worn.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "title_ids must be a list of title ids" }, { status: 400 })
  const ids = [...new Set(parsed.data.title_ids)]

  const before = await loadWorn(supabase, user.id)
  const { error } = await supabase.rpc("equip_loadout", { p_title_ids: ids })
  if (error) {
    if (!isMissingSchema(error)) return titleError(titleErrorKey(error))
    if (ids.length > 1) return titleError("loadouts_pending")
    const single = await supabase.rpc("equip_title", { p_title_id: ids[0] ?? null })
    if (single.error) return titleError(isMissingSchema(single.error) ? "loadouts_pending" : titleErrorKey(single.error))
  }

  const after = await loadWorn(supabase, user.id)
  const items = after.map((t) => ({ ...t, tier: tierOf(t.name, t.category, t.price) }))
  const primary = primaryOf(items)
  const effects = comboLines(
    combineEffects(after.filter((t) => t.for_self).map((t) => ({ title: t.name, kind: "equipped" as const })))
  ).map((line) => line.text)

  const beforeNames = new Set(before.map((t) => t.name))
  const added = after.filter((t) => !beforeNames.has(t.name))
  const actor = await getActor(supabase, user.id)
  if (added.length > 0) {
    const lead = primaryOf(added.map((t) => ({ ...t, tier: tierOf(t.name, t.category, t.price) }))) ?? added[0]
    emitLive("title.equipped", {
      actor,
      data: {
        title: lead.name,
        perk: isCurseCategory(lead.category) ? null : (perkInfo(lead.name, lead.category)?.summary ?? null),
        titles: after.map((t) => t.name),
        effects,
      },
    })
  } else if (after.length === 0 && before.length > 0) {
    const lowered = primaryOf(before.map((t) => ({ ...t, tier: tierOf(t.name, t.category, t.price) }))) ?? before[0]
    emitLive("title.unequipped", { actor, data: { title: lowered.name } })
  }

  return NextResponse.json({
    title_ids: after.map((t) => t.id),
    titles: after.map((t) => t.name),
    primary: primary?.name ?? null,
    effects,
  })
}
