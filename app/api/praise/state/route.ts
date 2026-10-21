import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { CROWNS_PER_DAY, PRAISE_REWARD, ROYAL_FAVOR } from "@/lib/praise/rules"
import { PRAISE_COLUMNS, loadAuthors, toPraiseView, type PraiseRow, type PraiseStateRow } from "@/lib/praise/server"
import type { PraiseState } from "@/lib/praise/types"

const FEATURED_CROWN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("praise_state")

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ available: false } satisfies PraiseState, { headers: NO_STORE })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const state = data as PraiseStateRow
  const userId = state.user_id
  const crownedSince = new Date(Date.now() - FEATURED_CROWN_WINDOW_MS).toISOString()
  let crownedQuery = supabase.from("praises").select(PRAISE_COLUMNS).eq("verdict", "crowned").gte("judged_at", crownedSince)
  let latestQuery = supabase.from("praises").select(PRAISE_COLUMNS)
  if (userId) {
    crownedQuery = crownedQuery.neq("user_id", userId)
    latestQuery = latestQuery.neq("user_id", userId)
  }

  const [crowned, latest, today] = await Promise.all([
    crownedQuery.order("judged_at", { ascending: false }).limit(1),
    latestQuery.order("created_at", { ascending: false }).limit(1),
    state.today_id
      ? supabase.from("praises").select(PRAISE_COLUMNS).eq("id", state.today_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const featuredRow = ((crowned.data?.[0] ?? latest.data?.[0]) as PraiseRow | undefined) ?? null
  const todayRow = (today.data as PraiseRow | null) ?? null
  const authors = await loadAuthors(supabase, [featuredRow?.user_id, todayRow?.user_id])
  const isSalaxe = !!userId && userId === state.salaxe_user_id

  const body: PraiseState = {
    available: true,
    today: state.today,
    resetsAt: state.resets_at,
    serverNow: state.server_now,
    reward: PRAISE_REWARD,
    favor: ROYAL_FAVOR,
    totalCount: state.total_count,
    salaxeUserId: state.salaxe_user_id,
    me: userId
      ? {
          userId,
          canSing: !state.today_id,
          today: todayRow ? toPraiseView(todayRow, authors) : null,
          total: state.my_total,
          crowned: state.my_crowned,
          favor: state.my_favor,
          legacy: state.my_legacy,
          isSalaxe,
        }
      : null,
    court: isSalaxe
      ? {
          pending: state.pending_count,
          crownsLeft: Math.max(0, CROWNS_PER_DAY - state.crowns_today),
          crownLimit: CROWNS_PER_DAY,
        }
      : null,
    featured: featuredRow ? toPraiseView(featuredRow, authors) : null,
  }

  return NextResponse.json(body, { headers: NO_STORE })
}
