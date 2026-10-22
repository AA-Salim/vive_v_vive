import type { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { loadPlayerProfile, profileError, profileJson, UnknownActError } from "@/lib/profiles/server"
import { ScopeParam } from "@/lib/profiles/types"

const IdParam = z.guid()

export async function GET(request: NextRequest, ctx: RouteContext<"/api/players/[id]/profile">) {
  const id = IdParam.safeParse((await ctx.params).id)
  if (!id.success) return profileError("That is not a player the court knows.", 400)
  const scope = ScopeParam.safeParse(request.nextUrl.searchParams.get("act") ?? undefined)
  if (!scope.success) return profileError("Pick an act number, current or all.", 400)

  const supabase = await createClient()
  try {
    const profile = await loadPlayerProfile(supabase, id.data, scope.data)
    if (!profile) return profileError("No such player in the royal register.", 404)
    return profileJson(profile)
  } catch (error) {
    if (error instanceof UnknownActError) return profileError(error.message, 404)
    return profileError("The royal scribes dropped the scrolls. Try again in a moment.", 500)
  }
}
