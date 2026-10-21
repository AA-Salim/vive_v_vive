import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { buildHallOfFame } from "@/lib/betting/server/hall"
import { loadBettors, loadSettledBets } from "@/lib/betting/server/rows"
import type { HallOfFame } from "@/lib/betting/types"

export async function GET(request: Request) {
  const wantsAll = new URL(request.url).searchParams.get("scope") === "all"
  const supabase = await createClient()

  try {
    let act: HallOfFame["act"] = null
    if (!wantsAll) {
      const { data } = await supabase
        .from("acts")
        .select("act_number, name, started_at")
        .eq("status", "active")
        .maybeSingle()
      if (data) act = { number: data.act_number, name: data.name, started_at: data.started_at }
    }

    const { rows, version } = await loadSettledBets(supabase, act?.started_at ?? null)
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
