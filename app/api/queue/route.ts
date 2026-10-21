import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { ADMIN_ONLY, AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"
import { appendToQueue, clearQueue, loadQueue, moveEntry, pruneQueue, removeFromQueue, writeOrder } from "@/lib/lobby/server/queue"
import { getLobbyViewer, resolveTarget } from "@/lib/lobby/server/viewer"
import { QueueActionSchema } from "@/lib/lobby/types"

export async function GET() {
  const supabase = await createClient()
  const { snapshot, error } = await loadQueue(supabase)
  if (error) return fail(500, "The queue ledger is unreadable right now.")
  return ok(snapshot.entries)
}

export async function POST(request: Request) {
  const parsed = QueueActionSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error, "Unknown queue action")
  const action = parsed.data

  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()
  if ((action.action === "move" || action.action === "clear") && !viewer.isAdmin) return ADMIN_ONLY()

  const { snapshot, error } = await loadQueue(supabase)
  if (error) return fail(500, "The queue ledger is unreadable right now.")
  const actor = await getActor(supabase, viewer.userId)

  switch (action.action) {
    case "join": {
      const target = resolveTarget(viewer, action.player_id)
      if ("error" in target) return fail(target.status, target.error, "no_player")
      if (snapshot.entries.some((e) => e.player_id === target.playerId)) {
        return ok(snapshot.entries)
      }
      const { data: player } = await supabase
        .from("players")
        .select("id, name, is_active, auth_user_id")
        .eq("id", target.playerId)
        .maybeSingle()
      if (!player) return fail(404, "That player does not exist.")
      if (!player.is_active) return fail(409, `${player.name} is benched. An admin can bring them back.`, "benched")

      const { added, error: addError } = await appendToQueue(supabase, snapshot, [target.playerId])
      if (addError) return fail(500, "Could not join the queue. Try again.")
      const { snapshot: next } = await loadQueue(supabase)
      if (added.length > 0) {
        emitLive("queue.changed", {
          actor,
          data: {
            action: "joined",
            playerName: player.name,
            count: next.entries.length,
            targetUserId: player.auth_user_id !== viewer.userId ? player.auth_user_id : null,
          },
        })
      }
      return ok(next.entries)
    }

    case "leave": {
      const target = resolveTarget(viewer, action.player_id)
      if ("error" in target) return fail(target.status, target.error, "no_player")
      const entry = snapshot.entries.find((e) => e.player_id === target.playerId)
      const { removed, error: removeError } = await removeFromQueue(supabase, [target.playerId])
      if (removeError) return fail(500, "Could not leave the queue. Try again.")
      await pruneQueue(supabase, snapshot)
      const { snapshot: next } = await loadQueue(supabase)
      if (removed > 0 && entry) {
        emitLive("queue.changed", {
          actor,
          data: {
            action: "left",
            playerName: entry.name,
            count: next.entries.length,
            targetUserId: entry.user_id !== viewer.userId ? entry.user_id : null,
          },
        })
      }
      return ok(next.entries)
    }

    case "move": {
      const reordered = moveEntry(snapshot.entries, action.player_id, action.to)
      if (!reordered) return fail(404, "That player is not in the queue.")
      const writeError = await writeOrder(supabase, reordered)
      if (writeError) return fail(500, "Could not reorder the queue. Try again.")
      await pruneQueue(supabase, snapshot)
      const { snapshot: next } = await loadQueue(supabase)
      const moved = next.entries.find((e) => e.player_id === action.player_id)
      emitLive("queue.changed", {
        actor,
        data: {
          action: "reordered",
          playerName: moved?.name ?? null,
          count: next.entries.length,
          targetUserId: moved?.user_id && moved.user_id !== viewer.userId ? moved.user_id : null,
        },
      })
      return ok(next.entries)
    }

    case "clear": {
      if (snapshot.entries.length === 0 && snapshot.staleIds.length === 0) return ok([])
      const clearError = await clearQueue(supabase)
      if (clearError) return fail(500, "Could not clear the queue. Try again.")
      emitLive("queue.changed", { actor, data: { action: "cleared", count: 0 } })
      return ok([])
    }
  }
}
