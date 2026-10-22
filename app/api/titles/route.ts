import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { isCurseCategory, perkInfo, rarityOf, tierOf } from "@/lib/titles/catalog"
import { titleDomain, titleEffects } from "@/lib/titles/effects"
import { loadoutSlotOf, primaryOf } from "@/lib/titles/loadout"
import { titleGames } from "@/lib/titles/pricing"
import { dignityCost } from "@/lib/titles/rules"
import { titleRulesVersion } from "@/lib/titles/rules-version"
import { setsOf } from "@/lib/titles/sets"
import { brandState, earliest, isBrand, loadIdentities, loadOwnership, loadResolvedGames, loadTitles, titleWorks, titlesLocked } from "@/lib/titles/server"
import type { LedgerItem, OwnedTitleView, PerkLedger, TitlesCatalogResponse, TitleView } from "@/lib/titles/types"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const loaded = await Promise.all([loadTitles(supabase), loadOwnership(supabase)]).catch(() => null)
  if (!loaded) {
    return NextResponse.json({ error: "The Hall of Titles is closed for cleaning. Try again." }, { status: 500 })
  }
  const [titles, ownership] = loaded

  const titleById = new Map(titles.map((t) => [t.id, t]))
  const mine = user ? ownership.filter((o) => o.user_id === user.id) : []
  const myBrands = mine.filter((o) => {
    const t = titleById.get(o.title_id)
    return !!t && isBrand(o, t)
  })

  const [locked, resolved, identities, balance, ledger, loadouts] = await Promise.all([
    titlesLocked(supabase),
    loadResolvedGames(supabase, earliest(myBrands.map((b) => b.created_at))),
    loadIdentities(supabase, myBrands.map((b) => b.assigned_by ?? "")),
    user ? loadBalance(supabase, user.id) : Promise.resolve(null),
    user ? loadLedger(supabase, user.id) : Promise.resolve({ ledger: null, migrated: true }),
    loadoutsReady(supabase),
  ])

  const holders = new Map<string, number>()
  const wearing = new Map<string, number>()
  for (const o of ownership) {
    holders.set(o.title_id, (holders.get(o.title_id) ?? 0) + 1)
    if (o.is_active && titleWorks(o)) wearing.set(o.title_id, (wearing.get(o.title_id) ?? 0) + 1)
  }

  const seasonal = titleRulesVersion() >= 2
  const views: TitleView[] = titles.map((t) => {
    const tier = tierOf(t.name, t.category, t.price)
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      price: t.price,
      category: t.category,
      for_self: t.for_self,
      is_permanent: t.is_permanent,
      rarity: rarityOf(t.name, t.category, t.price),
      perk: perkInfo(t.name, t.category, "you"),
      holders: holders.get(t.id) ?? 0,
      wearing: wearing.get(t.id) ?? 0,
      tier,
      slot: loadoutSlotOf({ name: t.name, category: t.category, tier }),
      effects: titleEffects(t.name),
      domain: titleDomain(t.name),
      dignity_cost: t.for_self ? null : dignityCost(t.price),
      ...(seasonal ? { games: t.for_self ? titleGames(tier, t.category, t.price) : null, sets: setsOf(t.name).map((s) => s.name) } : {}),
    }
  })

  const collection: OwnedTitleView[] = mine.flatMap((o) => {
    const t = titleById.get(o.title_id)
    if (!t) return []
    const curse = isBrand(o, t) ? brandState(o, t.price, resolved) : null
    const bestower = o.assigned_by ? identities.get(o.assigned_by) : undefined
    return [
      {
        title_id: o.title_id,
        is_active: o.is_active && titleWorks(o),
        equipped_at: o.equipped_at ?? null,
        acquired_at: o.created_at,
        bestowed_by: o.assigned_by ? { id: o.assigned_by, name: bestower?.name ?? "A mystery noble" } : null,
        curse,
        perk: isCurseCategory(t.category)
          ? curse?.active
            ? perkInfo(t.name, t.category, bestower?.name ?? "whoever branded you")
            : null
          : perkInfo(t.name, t.category),
        ...(o.games_left !== undefined ? { games_left: o.games_left } : {}),
      },
    ]
  })

  const viewById = new Map(views.map((v) => [v.id, v]))
  const worn = mine.flatMap((o) => {
    const v = o.is_active && titleWorks(o) ? viewById.get(o.title_id) : undefined
    return v ? [{ id: v.id, name: v.name, category: v.category, tier: v.tier, equippedAt: o.equipped_at ?? null }] : []
  })

  const body: TitlesCatalogResponse = {
    titles: views,
    owned: mine.map((o) => o.title_id),
    active_title_id: primaryOf(worn)?.id ?? null,
    active_title_ids: worn.map((w) => w.id),
    loadouts,
    collection,
    balance,
    locked,
    ledger: ledger.ledger,
    migrated: ledger.migrated,
    rules: titleRulesVersion(),
  }
  return NextResponse.json(body)
}

// Loadouts need supabase/phase10_title-effects.sql; before it, one title at a time.
async function loadoutsReady(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("title_slot_rules").select("slot").limit(1)
  return !error
}

async function loadBalance(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle()
  return (data?.balance as number | undefined) ?? null
}

async function loadLedger(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ledger: PerkLedger; migrated: boolean }> {
  const { data: act } = await supabase.from("acts").select("started_at").eq("status", "active").maybeSingle()
  const since = (act?.started_at as string | undefined) ?? new Date(0).toISOString()

  const [{ data: txns }, applications] = await Promise.all([
    supabase
      .from("point_transactions")
      .select("id, amount, reason, created_at")
      .eq("user_id", userId)
      .in("reason", ["title_perk", "title_curse", "title_tribute"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("title_perk_applications")
      .select("id, user_id, title_name, kind, amount, beneficiary_user_id, detail, created_at")
      .or(`user_id.eq.${userId},beneficiary_user_id.eq.${userId}`)
      .neq("amount", 0)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const rows = txns ?? []
  const perks = rows.filter((t) => t.reason !== "title_tribute").reduce((sum, t) => sum + (t.amount as number), 0)
  const tributes = rows.filter((t) => t.reason === "title_tribute").reduce((sum, t) => sum + (t.amount as number), 0)

  const migrated = !isMissingSchema(applications.error)
  const recent: LedgerItem[] =
    migrated && applications.data
      ? applications.data.map((a) => {
          const asWearer = a.user_id === userId
          return {
            id: a.id as string,
            at: a.created_at as string,
            title: a.title_name as string,
            kind: asWearer ? (a.kind as "perk" | "curse") : "tribute",
            amount: asWearer ? (a.amount as number) : -(a.amount as number),
            detail: a.detail as string,
          }
        })
      : rows.slice(0, 8).map((t) => ({
          id: t.id as string,
          at: t.created_at as string,
          title: null,
          kind: t.reason === "title_tribute" ? "tribute" : t.reason === "title_curse" ? "curse" : "perk",
          amount: t.amount as number,
          detail:
            t.reason === "title_tribute"
              ? "Tribute from a branded subject"
              : t.reason === "title_curse"
                ? "Paid for wearing a brand"
                : "Title perk",
        }))

  return { ledger: { perks, tributes, recent }, migrated }
}
