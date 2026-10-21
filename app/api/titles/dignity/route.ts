import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { titleError, titleErrorKey } from "@/lib/titles/errors"
import { loadIdentities } from "@/lib/titles/server"

const Body = z.object({ title_id: z.guid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return titleError("not_authenticated")

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid title_id is required" }, { status: 400 })

  const { data, error } = await supabase.rpc("lift_title_curse", { p_title_id: parsed.data.title_id })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("Dignity buybacks")
    return titleError(titleErrorKey(error))
  }

  const result = data as { title: string; cost: number; bestowed_by: string | null; balance: number }
  const bestower = result.bestowed_by ? (await loadIdentities(supabase, [result.bestowed_by])).get(result.bestowed_by) : undefined

  emitLive("title.dignity", {
    actor: await getActor(supabase, user.id),
    data: { title: result.title, cost: result.cost, bestowerName: bestower?.name ?? null },
  })

  return NextResponse.json({ lifted: true, title: result.title, cost: result.cost, balance: result.balance })
}
