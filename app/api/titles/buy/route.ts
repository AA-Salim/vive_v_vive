import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { perkInfo } from "@/lib/titles/catalog"
import { titleError, titleErrorKey } from "@/lib/titles/errors"
import { MAX_ACTIVE_CURSES } from "@/lib/titles/rules"
import { brandState, earliest, loadIdentities, loadResolvedGames, type TitleRow } from "@/lib/titles/server"

const Body = z.object({
  title_id: z.guid(),
  target_user_id: z.guid().optional().nullable(),
})

type Supabase = Awaited<ReturnType<typeof createClient>>

interface Purchase {
  recipient: string
  rebranded: boolean
  balance: number | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid title_id is required" }, { status: 400 })
  const { title_id: titleId, target_user_id: targetId } = parsed.data

  const { data: titleData } = await supabase
    .from("titles")
    .select("id, name, description, price, category, for_self, is_permanent")
    .eq("id", titleId)
    .maybeSingle()
  const title = titleData as TitleRow | null
  if (!title) return titleError("title_not_found")

  let purchase: Purchase
  const { data, error } = await supabase.rpc("buy_title", { p_title_id: titleId, p_target_user_id: targetId ?? null })
  if (error) {
    if (!isMissingSchema(error)) {
      const key = titleErrorKey(error)
      return titleError(key === "already_owned" && !title.for_self ? "already_branded" : key)
    }
    const legacy = await legacyPurchase(supabase, user.id, title, targetId ?? null)
    if ("error" in legacy) return titleError(legacy.error)
    purchase = legacy
  } else {
    const result = data as { recipient: string; rebranded: boolean; balance: number }
    purchase = { recipient: result.recipient, rebranded: result.rebranded, balance: result.balance }
  }

  const actor = await getActor(supabase, user.id)
  if (title.for_self) {
    emitLive("title.bought", { actor, data: { title: title.name, price: title.price } })
  } else {
    const target = (await loadIdentities(supabase, [purchase.recipient])).get(purchase.recipient)
    emitLive("title.bestowed", {
      actor,
      data: {
        title: title.name,
        targetName: target?.name ?? "someone",
        targetUserId: purchase.recipient,
        curse: perkInfo(title.name, title.category, actor?.name ?? "the brander")?.summary ?? null,
      },
    })
  }

  return NextResponse.json({
    purchased: true,
    title: title.name,
    recipient: purchase.recipient,
    rebranded: purchase.rebranded,
    balance: purchase.balance,
  })
}

// Pre-migration path: same checks as buy_title(), charge first and refund if the grant fails.
async function legacyPurchase(
  supabase: Supabase,
  userId: string,
  title: TitleRow,
  targetId: string | null
): Promise<Purchase | { error: string }> {
  if (title.category === "award" || title.price <= 0) return { error: "not_for_sale" }
  const recipient = title.for_self ? userId : targetId
  if (!recipient) return { error: "target_required" }
  if (!title.for_self && recipient === userId) return { error: "self_target" }

  const { data: profile } = await supabase.from("user_profiles").select("id").eq("id", recipient).maybeSingle()
  if (!profile) return { error: "target_not_found" }

  const { data: existing } = await supabase
    .from("user_titles")
    .select("id")
    .eq("user_id", recipient)
    .eq("title_id", title.id)
    .maybeSingle()
  if (existing) return { error: title.for_self ? "already_owned" : "already_branded" }

  if (!title.for_self) {
    const { data: brands } = await supabase
      .from("user_titles")
      .select("id, user_id, title_id, is_active, assigned_by, created_at, titles!inner ( for_self, price )")
      .eq("user_id", recipient)
      .not("assigned_by", "is", null)
      .eq("titles.for_self", false)
    const rows = brands ?? []
    const resolved = await loadResolvedGames(supabase, earliest(rows.map((r) => r.created_at as string)))
    const active = rows.filter((r) => brandState(r, 0, resolved).active).length
    if (active >= MAX_ACTIVE_CURSES) return { error: "curse_limit" }
  }

  const { data: balance, error: chargeError } = await supabase.rpc("adjust_balance", {
    p_user_id: userId,
    p_amount: -title.price,
    p_reason: "title_bought",
    p_reference_id: title.id,
  })
  if (chargeError) return { error: titleErrorKey(chargeError) ?? (chargeError.code === "42501" ? "unknown" : "insufficient") }

  const { error: insertError } = await supabase.from("user_titles").insert({
    user_id: recipient,
    title_id: title.id,
    assigned_by: title.for_self ? null : userId,
    is_active: false,
  })
  if (insertError) {
    await supabase.rpc("adjust_balance", {
      p_user_id: userId,
      p_amount: title.price,
      p_reason: "title_bought",
      p_reference_id: title.id,
    })
    return { error: insertError.code === "23505" ? (title.for_self ? "already_owned" : "already_branded") : "unknown" }
  }

  return { recipient, rebranded: false, balance: typeof balance === "number" ? balance : null }
}
