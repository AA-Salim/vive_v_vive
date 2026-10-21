import { createClient } from "@/lib/supabase"
import { emitLive, getActor } from "@/lib/live/server"
import { ADMIN_ONLY, AUTH_REQUIRED, fail, invalid, ok, readJson } from "@/lib/lobby/server/http"
import { PLAYER_COLUMNS, findPlayerByName, loadRoster, toRosterPlayer } from "@/lib/lobby/server/roster"
import { getLobbyViewer } from "@/lib/lobby/server/viewer"
import { CreatePlayerSchema } from "@/lib/lobby/types"

export async function GET() {
  const supabase = await createClient()
  const { players, error } = await loadRoster(supabase)
  if (error) return fail(500, "The roster scroll is unreadable right now.")
  return ok(players)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const viewer = await getLobbyViewer(supabase)
  if (!viewer.userId) return AUTH_REQUIRED()
  if (!viewer.isAdmin) return ADMIN_ONLY()

  const parsed = CreatePlayerSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const name = parsed.data.name

  if (await findPlayerByName(supabase, name)) return fail(409, `${name} is already on the roster.`, "duplicate")

  const { data, error } = await supabase.from("players").insert({ name }).select(PLAYER_COLUMNS).single()
  if (error) {
    if (error.code === "23505") return fail(409, `${name} is already on the roster.`, "duplicate")
    return fail(500, "Could not add the player. Try again.")
  }

  emitLive("roster.changed", {
    actor: await getActor(supabase, viewer.userId),
    data: { action: "added", playerName: name },
    persist: false,
  })
  return ok(toRosterPlayer(data), 201)
}
