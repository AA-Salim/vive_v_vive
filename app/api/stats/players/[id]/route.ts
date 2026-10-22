import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { computePlayerDetail } from "@/lib/pages/compute-player-detail"
import { seasonFromRequest } from "@/lib/pages/season"
import { json, loadMatchContext, scribeError } from "@/lib/pages/server"
import type { PlayerDetailResponse } from "@/lib/pages/types"

const Params = z.object({ id: z.guid() })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await params)
  if (!parsed.success) return scribeError("That is not a player the court knows.", 400)

  const supabase = await createClient()
  try {
    const scope = await seasonFromRequest(supabase, request)
    if ("error" in scope) return scope.error
    const context = await loadMatchContext(supabase, scope.window)
    if (!context.data.players.has(parsed.data.id)) return scribeError("No such player in the royal register.", 404)
    const detail = computePlayerDetail(context.data, context.internalOf, parsed.data.id)
    if (!detail) return scribeError(scope.season ? "No games for this player in that act." : "This player has not set foot on the Rift yet.", 404)
    const body: PlayerDetailResponse = { ...detail, season: scope.season }
    return json(body)
  } catch {
    return scribeError()
  }
}
