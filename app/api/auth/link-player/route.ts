import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { isMissingSchema } from "@/lib/db-errors"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"

const Body = z.object({ player_id: z.guid() })

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

const CLAIM_ERRORS: Record<string, [string, number]> = {
  "claim:not_found": ["Player not found", 404],
  "claim:taken": ["Player already claimed by another user", 409],
  "claim:has_player": ["You already answer to another name on the roster.", 409],
}

type Claim = { name: string; newlyClaimed: boolean } | NextResponse

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Not authenticated", 401)

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("player_id is required", 400)
  const playerId = parsed.data.player_id

  // claim_player (phase10_hardening.sql) links an unclaimed player to a caller who has none, atomically.
  const { data, error } = await supabase.rpc("claim_player", { p_player_id: playerId })
  let claim: Claim
  if (!error) {
    const result = data as { name: string; newly_claimed: boolean }
    claim = { name: result.name, newlyClaimed: result.newly_claimed }
  } else if (isMissingSchema(error)) {
    claim = await legacyClaim(supabase, user.id, playerId)
  } else {
    const code = error.message?.match(/claim:[a-z_]+/)?.[0]
    const [message, status] = (code && CLAIM_ERRORS[code]) || ["Could not claim this player. Try again.", 500]
    return fail(message, status)
  }
  if (claim instanceof NextResponse) return claim

  if (claim.newlyClaimed) {
    emitLive("profile.linked", { actor: await getActor(supabase, user.id), data: { playerName: claim.name } })
  }
  return NextResponse.json({ success: true })
}

// Pre-hardening path.
async function legacyClaim(supabase: SupabaseClient, userId: string, playerId: string): Promise<Claim> {
  const [{ data: profile }, { data: player }] = await Promise.all([
    supabase.from("user_profiles").select("player_id").eq("id", userId).maybeSingle(),
    supabase.from("players").select("id, name, auth_user_id").eq("id", playerId).maybeSingle(),
  ])
  if (!player) return fail("Player not found", 404)
  if (profile?.player_id && profile.player_id !== playerId) {
    return fail("You already answer to another name on the roster.", 409)
  }
  if (player.auth_user_id && player.auth_user_id !== userId) {
    return fail("Player already claimed by another user", 409)
  }

  // Conditional write: two people racing for the same player cannot both win it.
  const { data: claimed, error: claimError } = await supabase
    .from("players")
    .update({ auth_user_id: userId })
    .eq("id", playerId)
    .or(`auth_user_id.is.null,auth_user_id.eq.${userId}`)
    .select("id")
    .maybeSingle()
  if (claimError) return fail(claimError.message, 500)
  if (!claimed) return fail("Player already claimed by another user", 409)

  const { error: profileError } = await supabase.from("user_profiles").update({ player_id: playerId }).eq("id", userId)
  if (profileError) {
    if (!player.auth_user_id) {
      await supabase.from("players").update({ auth_user_id: null }).eq("id", playerId).eq("auth_user_id", userId)
    }
    return fail(profileError.message, 500)
  }

  return { name: player.name as string, newlyClaimed: !player.auth_user_id }
}
