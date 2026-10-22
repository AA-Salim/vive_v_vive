import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { ACT_COLUMNS, buildArchiveDetail, type ActRow } from "@/lib/pages/archive"
import { json, scribeError } from "@/lib/pages/server"

const Params = z.object({ id: z.coerce.number().int().positive().max(1_000_000) })

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await params)
  if (!parsed.success) return scribeError("No act carries that number.", 400)

  const supabase = await createClient()
  try {
    const { data: act, error } = await supabase.from("acts").select(ACT_COLUMNS).eq("id", parsed.data.id).maybeSingle()
    if (error) return scribeError()
    if (!act) return scribeError("This chapter was never written.", 404)
    return json(await buildArchiveDetail(supabase, act as ActRow))
  } catch {
    return scribeError()
  }
}
