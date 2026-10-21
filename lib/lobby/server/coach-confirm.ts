import type { SupabaseClient } from "@supabase/supabase-js"
import { getChampionPools } from "@/lib/champions-db"
import { LANES } from "@/lib/lobby/constants"
import { sideOfCoach, type Draft, type DraftOutcome } from "@/lib/lobby/server/coach-draft"
import { removeFromQueue } from "@/lib/lobby/server/queue"
import type { LobbyViewer } from "@/lib/lobby/server/viewer"
import { assignChampions } from "@/lib/randomizer"
import { todaysFearless } from "@/lib/session/phases"
import { SESSION_SELECT, loadSession, type SessionRow } from "@/lib/session/server"
import type { Player, Role, Side } from "@/lib/types"

export interface ConfirmResult {
  session: SessionRow
  changed: boolean
  dequeued: number
}

function lanesComplete(draft: Draft, side: Side): "ok" | "lanes_missing" | "lane_clash" | "picks_missing" {
  const team = draft.picks.filter((p) => p.side === side)
  if (team.length !== 5) return "picks_missing"
  if (team.some((p) => !p.lane)) return "lanes_missing"
  return new Set(team.map((p) => p.lane)).size === LANES.length ? "ok" : "lane_clash"
}

// Locks both teams and deals champions. The status flip is a compare-and-set on the draft version, so two coaches
// locking at once deal exactly one set of champions, and a pick or lane change in flight makes the lock retry.
// The flip also stamps updated_at: that is the start of the shared reveal for everyone in the room.
export async function confirmDraft(supabase: SupabaseClient, viewer: LobbyViewer, draft: Draft): Promise<DraftOutcome<ConfirmResult>> {
  const { session, picks } = draft
  if (session.status === "draft") {
    const { session: current } = await loadSession(supabase, session.id)
    return current ? { ok: true, value: { session: current, changed: false, dequeued: 0 } } : { ok: false, code: "session_not_found" }
  }
  if (session.status !== "coach_draft") return { ok: false, code: "not_drafting" }
  if (!sideOfCoach(session, viewer.userId) && !viewer.isAdmin) return { ok: false, code: "not_a_coach" }
  if (picks.length < 10) return { ok: false, code: "picks_missing" }
  for (const side of ["blue", "red"] as const) {
    const check = lanesComplete(draft, side)
    if (check !== "ok") return { ok: false, code: check }
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, is_active, wins, losses, games_played, created_at")
    .in(
      "id",
      picks.map((p) => p.player_id)
    )
  if (playersError) return { ok: false, code: "server", message: playersError.message }
  const byId = new Map(((players ?? []) as Player[]).map((p) => [p.id, p]))
  const team = (side: Side) =>
    picks
      .filter((p) => p.side === side)
      .flatMap((p) => {
        const player = byId.get(p.player_id)
        return player ? [{ player, lane: p.lane as Role }] : []
      })
  const blue = team("blue")
  const red = team("red")
  if (blue.length !== 5 || red.length !== 5) return { ok: false, code: "player_unavailable", message: "A drafted player left the roster." }

  const [fearless, pools] = await Promise.all([todaysFearless(supabase), getChampionPools()])
  const assignments = assignChampions(blue, red, fearless, new Map(), pools)

  const { data: moved, error: moveError } = await supabase
    .from("game_sessions")
    .update({ status: "draft", draft_turn: null, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "coach_draft")
    .eq("updated_at", session.updated_at)
    .select("id, updated_at")
    .maybeSingle()
  if (moveError) return { ok: false, code: "server", message: moveError.message }
  if (!moved) {
    const { session: latest } = await loadSession(supabase, session.id)
    if (latest?.status === "draft") return { ok: true, value: { session: latest, changed: false, dequeued: 0 } }
    return { ok: false, code: "stale" }
  }

  const { error: insertError } = await supabase.from("session_assignments").insert(
    assignments.map((a) => ({
      session_id: session.id,
      player_id: a.player.id,
      side: a.side,
      lane: a.lane,
      champion: a.champion,
      champion_internal: a.championInternal,
      locked: false,
      fearless_override: a.fearlessOverride,
    }))
  )
  if (insertError) {
    await supabase
      .from("game_sessions")
      .update({ status: "coach_draft", draft_turn: null, updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("status", "draft")
      .eq("updated_at", moved.updated_at as string)
    return { ok: false, code: "server", message: insertError.message }
  }

  // The ten are playing now: their queue spots are spent.
  const { removed } = await removeFromQueue(supabase, picks.map((p) => p.player_id))

  const { data: fresh } = await supabase.from("game_sessions").select(SESSION_SELECT).eq("id", session.id).maybeSingle()
  if (!fresh) return { ok: false, code: "session_not_found" }
  return { ok: true, value: { session: fresh as SessionRow, changed: true, dequeued: removed } }
}
