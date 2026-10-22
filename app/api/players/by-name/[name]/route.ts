import type { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { findPlayerIdByName, loadPlayerProfile, profileError, profileJson, UnknownActError } from "@/lib/profiles/server"
import { ScopeParam } from "@/lib/profiles/types"

const NameParam = z.string().trim().min(1).max(64)

export async function GET(request: NextRequest, ctx: RouteContext<"/api/players/by-name/[name]">) {
  const name = NameParam.safeParse((await ctx.params).name)
  if (!name.success) return profileError("That is not a name the court knows.", 400)
  const scope = ScopeParam.safeParse(request.nextUrl.searchParams.get("act") ?? undefined)
  if (!scope.success) return profileError("Pick an act number, current or all.", 400)

  const supabase = await createClient()
  try {
    const id = await findPlayerIdByName(supabase, name.data)
    const profile = id ? await loadPlayerProfile(supabase, id, scope.data) : null
    if (!profile) return profileError(`No ${name.data} in the royal register.`, 404)
    return profileJson(profile)
  } catch (error) {
    if (error instanceof UnknownActError) return profileError(error.message, 404)
    return profileError("The royal scribes dropped the scrolls. Try again in a moment.", 500)
  }
}
