import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { tierOf } from "@/lib/titles/catalog"
import { primaryOf } from "@/lib/titles/loadout"
import { brandState, earliest, isBrand, loadAllIdentities, loadOwnership, loadResolvedGames, loadTitles } from "@/lib/titles/server"
import type { CourtMember, CourtResponse } from "@/lib/titles/types"

export async function GET() {
  const supabase = await createClient()
  const loaded = await Promise.all([loadAllIdentities(supabase), loadOwnership(supabase), loadTitles(supabase)]).catch(
    () => null
  )
  if (!loaded) return NextResponse.json({ error: "The court roll is unavailable" }, { status: 500 })
  const [identities, ownership, titles] = loaded

  const titleById = new Map(titles.map((t) => [t.id, t]))
  const brands = ownership.filter((o) => {
    const t = titleById.get(o.title_id)
    return !!t && isBrand(o, t)
  })
  const resolved = await loadResolvedGames(supabase, earliest(brands.map((b) => b.created_at)))

  const members: CourtMember[] = identities
    .map((identity) => {
      const rows = ownership.filter((o) => o.user_id === identity.userId)
      const worn = rows.flatMap((o) => {
        const t = o.is_active ? titleById.get(o.title_id) : undefined
        return t ? [{ name: t.name, category: t.category, tier: tierOf(t.name, t.category, t.price), equippedAt: o.equipped_at ?? null }] : []
      })
      const primary = primaryOf(worn)
      return {
        id: identity.userId,
        name: identity.name,
        username: identity.username,
        avatar_url: identity.avatarUrl,
        equipped: primary?.name ?? null,
        loadout: primary ? [primary.name, ...worn.filter((w) => w !== primary).map((w) => w.name)] : [],
        curses: brands
          .filter((b) => b.user_id === identity.userId)
          .flatMap((b) => {
            const t = titleById.get(b.title_id)
            const state = t ? brandState(b, t.price, resolved) : null
            return t && state?.active ? [{ title: t.name, left: state.left }] : []
          }),
        owned_title_ids: rows.map((o) => o.title_id),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

  const body: CourtResponse = { members }
  return NextResponse.json(body)
}
