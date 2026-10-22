import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { buildHallOfFame } from "@/lib/betting/server/hall"
import { loadBettors, loadSettledBets } from "@/lib/betting/server/rows"
import type { HallOfFame } from "@/lib/betting/types"
import { resolveSeason, SeasonParam, type SeasonChoice } from "@/lib/pages/season"
import { seasonTitle } from "@/lib/pages/season-calendar"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const parsed = SeasonParam.safeParse(params.get("act") || undefined)
  if (!parsed.success) return NextResponse.json({ error: "That season is not in the royal calendar." }, { status: 400 })
  // ?scope=all is the old toggle: older tabs still send it.
  const choice: SeasonChoice = params.get("scope") === "all" ? "all" : parsed.data
  const supabase = await createClient()

  try {
    const scope = await resolveSeason(supabase, choice)
    if ("error" in scope) return scope.error
    const act: HallOfFame["act"] = scope.season
      ? { number: scope.season.number, name: seasonTitle(scope.season), started_at: scope.season.startedAt }
      : null

    const { rows, version } = await loadSettledBets(supabase, scope.window.from, scope.window.to)
    const bettors = await loadBettors(
      supabase,
      rows.map((r) => r.user_id)
    )
    return NextResponse.json(buildHallOfFame(rows, bettors, act ? "act" : "all", act, version), {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json({ error: "The hall is closed for repairs. Try again." }, { status: 500 })
  }
}
