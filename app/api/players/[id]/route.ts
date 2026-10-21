import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { ADMIN_ONLY, AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"
import { removeFromQueue } from "@/lib/lobby/server/queue"
import { PLAYER_COLUMNS, findPlayerByName, playerHasHistory, toRosterPlayer } from "@/lib/lobby/server/roster"
import { getLobbyViewer } from "@/lib/lobby/server/viewer"
import { UpdatePlayerSchema } from "@/lib/lobby/types"

type Params = { params: Promise<{ id: string }> }

const IdSchema = z.guid()

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "That player does not exist.")

  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()
  if (!viewer.isAdmin) return ADMIN_ONLY()

  const parsed = UpdatePlayerSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const patch = parsed.data

  const { data: current } = await supabase.from("players").select(PLAYER_COLUMNS).eq("id", id).maybeSingle()
  if (!current) return fail(404, "That player does not exist.")

  const renamed = patch.name !== undefined && patch.name !== current.name
  if (renamed && patch.name && (await findPlayerByName(supabase, patch.name, id))) {
    return fail(409, `${patch.name} is already on the roster.`, "duplicate")
  }

  const { data, error } = await supabase.from("players").update(patch).eq("id", id).select(PLAYER_COLUMNS).single()
  if (error) {
    if (error.code === "23505") return fail(409, `${patch.name} is already on the roster.`, "duplicate")
    return fail(500, "Could not update the player. Try again.")
  }

  const benched = patch.is_active === false && current.is_active
  const activated = patch.is_active === true && !current.is_active
  if (benched) await removeFromQueue(supabase, [id])

  const actor = await getActor(supabase, viewer.userId)
  if (renamed) {
    emitLive("roster.changed", { actor, data: { action: "renamed", playerName: data.name, previousName: current.name }, persist: false })
  }
  if (benched || activated) {
    emitLive("roster.changed", { actor, data: { action: benched ? "benched" : "activated", playerName: data.name }, persist: false })
  }
  return ok(toRosterPlayer(data))
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  if (!IdSchema.safeParse(id).success) return fail(404, "That player does not exist.")

  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()
  if (!viewer.isAdmin) return ADMIN_ONLY()

  const { data: player } = await supabase.from("players").select("id, name, games_played, auth_user_id").eq("id", id).maybeSingle()
  if (!player) return fail(404, "That player does not exist.")
  if (player.auth_user_id) return fail(409, `${player.name} is claimed by a Discord account. Bench them instead.`, "claimed")

  // Deleting cascades into game history, bounties and their escrow: only clean slates can go.
  const references = await playerHasHistory(supabase, id)
  if (references.error) return fail(500, "Could not check the archives. Try again.")
  const hasHistory = () => fail(409, `${player.name} has history in the archives. Bench them instead.`, "has_history")
  if ((player.games_played ?? 0) > 0 || references.history) return hasHistory()

  const { error } = await supabase.from("players").delete().eq("id", id)
  if (error) return error.code === "23503" ? hasHistory() : fail(500, "Could not remove the player. Try again.")

  emitLive("roster.changed", {
    actor: await getActor(supabase, viewer.userId),
    data: { action: "removed", playerName: player.name },
    persist: false,
  })
  return ok({ success: true })
}
