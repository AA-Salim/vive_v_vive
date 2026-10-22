import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { computePlayerDetail } from "@/lib/pages/compute-player-detail"
import { json, loadMatchContext, scribeError } from "@/lib/pages/server"

const Params = z.object({ id: z.guid() })

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await params)
  if (!parsed.success) return scribeError("That is not a player the court knows.", 400)

  const supabase = await createClient()
  try {
    const context = await loadMatchContext(supabase)
    if (!context.data.players.has(parsed.data.id)) return scribeError("No such player in the royal register.", 404)
    const detail = computePlayerDetail(context.data, context.internalOf, parsed.data.id)
    if (!detail) return scribeError("This player has not set foot on the Rift yet.", 404)
    return json(detail)
  } catch {
    return scribeError()
  }
}
