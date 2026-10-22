import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { isCurseCategory, perkInfo } from "@/lib/titles/catalog"
import { titleEffects } from "@/lib/titles/effects"
import { titleError, titleErrorKey } from "@/lib/titles/errors"
import { titlesLocked } from "@/lib/titles/server"

const Body = z.object({ title_id: z.guid().nullable() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "title_id must be a title id or null" }, { status: 400 })
  const titleId = parsed.data.title_id

  const { data: previous } = await supabase
    .from("user_titles")
    .select("titles ( name )")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase.rpc("equip_title", { p_title_id: titleId })
  let titleName = (data as { title?: string | null } | null)?.title ?? null
  let category: string | null = null

  if (error) {
    if (!isMissingSchema(error)) return titleError(titleErrorKey(error))
    const legacy = await legacyEquip(supabase, user.id, titleId)
    if ("error" in legacy) return titleError(legacy.error)
    titleName = legacy.name
    category = legacy.category
  } else if (titleId) {
    const { data: t } = await supabase.from("titles").select("category").eq("id", titleId).maybeSingle()
    category = (t?.category as string | undefined) ?? null
  }

  const joined = previous?.titles as { name?: string } | { name?: string }[] | null | undefined
  const prevName = (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? null
  if (titleId && titleName && titleName !== prevName) {
    const curse = !category || isCurseCategory(category)
    const perk = category && !curse ? (perkInfo(titleName, category)?.summary ?? null) : null
    const effects = curse ? [] : titleEffects(titleName).map((e) => e.text)
    emitLive("title.equipped", { actor: await getActor(supabase, user.id), data: { title: titleName, perk, titles: [titleName], effects } })
  } else if (!titleId && prevName) {
    emitLive("title.unequipped", { actor: await getActor(supabase, user.id), data: { title: prevName } })
  }

  return NextResponse.json({ activated: true, title_id: titleId, title: titleName })
}

type LegacyResult = { name: string | null; category: string | null } | { error: string }

async function legacyEquip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  titleId: string | null
): Promise<LegacyResult> {
  if (await titlesLocked(supabase)) return { error: "titles_locked" }

  let name: string | null = null
  let category: string | null = null
  if (titleId) {
    const { data: owned } = await supabase
      .from("user_titles")
      .select("id, titles ( name, category )")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .maybeSingle()
    if (!owned) return { error: "not_owned" }
    const joined = owned.titles as { name: string; category: string } | { name: string; category: string }[] | null
    const t = Array.isArray(joined) ? joined[0] : joined
    name = t?.name ?? null
    category = t?.category ?? null
  }

  await supabase.from("user_titles").update({ is_active: false }).eq("user_id", userId).eq("is_active", true)
  if (titleId) {
    await supabase.from("user_titles").update({ is_active: true }).eq("user_id", userId).eq("title_id", titleId)
  }
  return { name, category }
}
