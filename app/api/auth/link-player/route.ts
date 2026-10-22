import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"

const Body = z.object({ player_id: z.guid() })

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Not authenticated", 401)

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("player_id is required", 400)
  const playerId = parsed.data.player_id

  const [{ data: profile }, { data: player }] = await Promise.all([
    supabase.from("user_profiles").select("player_id").eq("id", user.id).maybeSingle(),
    supabase.from("players").select("id, name, auth_user_id").eq("id", playerId).maybeSingle(),
  ])
  if (!player) return fail("Player not found", 404)
  if (profile?.player_id && profile.player_id !== playerId) {
    return fail("You already answer to another name on the roster.", 409)
  }
  if (player.auth_user_id && player.auth_user_id !== user.id) {
    return fail("Player already claimed by another user", 409)
  }

  // Conditional write: two people racing for the same player cannot both win it.
  const { data: claimed, error: claimError } = await supabase
    .from("players")
    .update({ auth_user_id: user.id })
    .eq("id", playerId)
    .or(`auth_user_id.is.null,auth_user_id.eq.${user.id}`)
    .select("id")
    .maybeSingle()
  if (claimError) return fail(claimError.message, 500)
  if (!claimed) return fail("Player already claimed by another user", 409)

  const { error: profileError } = await supabase.from("user_profiles").update({ player_id: playerId }).eq("id", user.id)
  if (profileError) {
    if (!player.auth_user_id) {
      await supabase.from("players").update({ auth_user_id: null }).eq("id", playerId).eq("auth_user_id", user.id)
    }
    return fail(profileError.message, 500)
  }

  if (!player.auth_user_id) {
    emitLive("profile.linked", { actor: await getActor(supabase, user.id), data: { playerName: player.name as string } })
  }
  return NextResponse.json({ success: true })
}
