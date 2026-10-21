import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { RESOLVED_STATUSES, SEALING_STATUSES } from "@/lib/prophecy/constants"
import { buildBooks, emptyBooks } from "@/lib/prophecy/odds"
import {
  loadCandidates,
  loadProfiles,
  loadViewer,
  settleDueVotes,
  toTribunalInfo,
  toWagerView,
  type Profile,
  type VoteRow,
  type WagerRow,
} from "@/lib/prophecy/server"
import type { LegacyProphecyView, ProphecyBoard } from "@/lib/prophecy/types"
import type { SessionStatus } from "@/lib/types"

interface LegacyRow {
  id: string
  user_id: string
  prediction_type: string
  prediction_value: Record<string, unknown> | null
  correct: boolean | null
}

const LEGACY_LABELS: Record<string, string> = {
  player_gets_lane: "Lane Call",
  player_most_kills: "Kill Leader",
  side_wins_fast: "Fast Victory",
}

function describeLegacy(row: LegacyRow, names: Map<string, string>, profiles: Map<string, Profile>): LegacyProphecyView {
  const value = row.prediction_value ?? {}
  const player = typeof value.player_id === "string" ? names.get(value.player_id) ?? "Someone" : "Someone"
  let description = "A forgotten prophecy"
  if (row.prediction_type === "player_gets_lane") description = `${player} plays ${String(value.lane ?? "?").toUpperCase()}`
  if (row.prediction_type === "player_most_kills") description = `${player} gets the most kills`
  if (row.prediction_type === "side_wins_fast") description = `${value.side === "red" ? "Red" : "Blue"} wins in under 25 min`
  const profile = profiles.get(row.user_id)
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.name ?? "Someone",
    avatarUrl: profile?.avatarUrl ?? null,
    label: LEGACY_LABELS[row.prediction_type] ?? "Prophecy",
    description,
    correct: row.correct,
  }
}

export async function loadProphecyBoard(supabase: SupabaseClient, sessionId: string): Promise<ProphecyBoard | null> {
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id, status, betting_ends_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) return null

  const status = session.status as SessionStatus
  if (RESOLVED_STATUSES.includes(status)) await settleDueVotes(supabase, sessionId)

  const [viewer, candidates, wagersRes, legacyRes, voteRes] = await Promise.all([
    loadViewer(supabase),
    loadCandidates(supabase, sessionId),
    supabase
      .from("prophecy_wagers")
      .select("id, session_id, user_id, market, player_id, stake, status, payout, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("prophecies")
      .select("id, user_id, prediction_type, prediction_value, correct")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase.from("post_game_votes").select("*").eq("session_id", sessionId).maybeSingle(),
  ])

  const enabled = !isMissingSchema(wagersRes.error)
  if (enabled && wagersRes.error) throw new Error(wagersRes.error.message)

  const wagerRows = enabled ? ((wagersRes.data ?? []) as WagerRow[]) : []
  const legacyRows = (legacyRes.error ? [] : legacyRes.data ?? []) as LegacyRow[]
  const profiles = await loadProfiles(supabase, [
    ...wagerRows.map((w) => w.user_id),
    ...legacyRows.map((l) => l.user_id),
  ])
  const wagers = wagerRows.map((w) => toWagerView(w, profiles))
  const names = new Map(candidates.map((c) => [c.playerId, c.name]))
  const bettingExpired =
    status === "betting" && !!session.betting_ends_at && Date.parse(session.betting_ends_at as string) <= Date.now()

  return {
    enabled,
    now: new Date().toISOString(),
    sessionStatus: status,
    open: enabled && SEALING_STATUSES.includes(status) && !bettingExpired,
    closesAt: status === "betting" ? ((session.betting_ends_at as string | null) ?? null) : null,
    candidates,
    books: enabled ? buildBooks(wagers) : emptyBooks(),
    wagers,
    mine: viewer ? wagers.find((w) => w.userId === viewer.userId) ?? null : null,
    legacy: legacyRows.map((row) => describeLegacy(row, names, profiles)),
    viewer,
    tribunal: voteRes.data && !voteRes.error ? toTribunalInfo(voteRes.data as VoteRow) : null,
  }
}
