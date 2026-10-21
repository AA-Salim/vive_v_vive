import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { CATEGORIES, RESOLVED_STATUSES, type Category } from "@/lib/prophecy/constants"
import {
  loadCandidates,
  loadProfiles,
  loadViewer,
  openTribunal,
  settleDueVotes,
  toTribunalInfo,
  toWagerView,
  type VoteRow,
  type WagerRow,
} from "@/lib/prophecy/server"
import type { OpenTribunal, TribunalState, VoterView } from "@/lib/prophecy/types"
import type { SessionStatus } from "@/lib/types"

interface BallotRow {
  voter_id: string
  category: Category
  player_id: string
}

function perCategory<T>(make: () => T): Record<Category, T> {
  return { mvp: make(), inter: make() }
}

export async function loadTribunalState(supabase: SupabaseClient, sessionId: string): Promise<TribunalState | null> {
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id, status, game_id")
    .eq("id", sessionId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) return null

  const status = session.status as SessionStatus
  const resolved = RESOLVED_STATUSES.includes(status)
  if (resolved) await settleDueVotes(supabase, sessionId)

  const base = {
    now: new Date().toISOString(),
    sessionId,
    sessionStatus: status,
    tallies: perCategory<Record<string, number>>(() => ({})),
    voters: perCategory<Record<string, VoterView[]>>(() => ({})),
    ballots: perCategory(() => 0),
    mine: perCategory<string | null>(() => null),
    pots: perCategory(() => 0),
    myWager: null,
  }

  const voteRes = await supabase.from("post_game_votes").select("*").eq("session_id", sessionId).maybeSingle()
  if (isMissingSchema(voteRes.error)) {
    return { ...base, enabled: false, vote: null, candidates: [], viewer: null }
  }
  if (voteRes.error) throw new Error(voteRes.error.message)

  let voteRow = (voteRes.data as VoteRow | null) ?? null
  if (!voteRow && resolved && session.game_id) {
    voteRow = await openTribunal(supabase, sessionId, session.game_id as string)
  }

  const [viewer, candidates, ballotsRes, wagersRes] = await Promise.all([
    loadViewer(supabase),
    loadCandidates(supabase, sessionId),
    voteRow
      ? supabase.from("post_game_ballots").select("voter_id, category, player_id").eq("session_id", sessionId)
      : Promise.resolve({ data: [] as BallotRow[], error: null }),
    supabase
      .from("prophecy_wagers")
      .select("id, session_id, user_id, market, player_id, stake, status, payout, created_at")
      .eq("session_id", sessionId),
  ])

  const ballots = (ballotsRes.data ?? []) as BallotRow[]
  const wagers = (wagersRes.data ?? []) as WagerRow[]
  const profiles = await loadProfiles(supabase, [
    ...ballots.map((b) => b.voter_id),
    ...(viewer ? [viewer.userId] : []),
  ])

  const state: TribunalState = {
    ...base,
    enabled: true,
    vote: voteRow ? toTribunalInfo(voteRow) : null,
    candidates,
    viewer,
  }

  for (const ballot of ballots) {
    const category = ballot.category
    state.tallies[category][ballot.player_id] = (state.tallies[category][ballot.player_id] ?? 0) + 1
    state.ballots[category] += 1
    const profile = profiles.get(ballot.voter_id)
    const voters = state.voters[category][ballot.player_id] ?? []
    voters.push({ userId: ballot.voter_id, name: profile?.name ?? "Someone", avatarUrl: profile?.avatarUrl ?? null })
    state.voters[category][ballot.player_id] = voters
    if (viewer && ballot.voter_id === viewer.userId) state.mine[category] = ballot.player_id
  }

  for (const wager of wagers) {
    if (wager.status !== "refunded") state.pots[wager.market] += wager.stake
  }
  const mine = viewer ? wagers.find((w) => w.user_id === viewer.userId) : undefined
  state.myWager = mine ? toWagerView(mine, profiles) : null

  for (const category of CATEGORIES) {
    for (const list of Object.values(state.voters[category])) list.sort((a, b) => a.name.localeCompare(b.name))
  }

  return state
}

const RECENT_VERDICT_MS = 10 * 60 * 1000

export async function loadOpenTribunal(
  supabase: SupabaseClient
): Promise<{ enabled: boolean; tribunal: OpenTribunal | null }> {
  await settleDueVotes(supabase, null)
  const { data, error } = await supabase
    .from("post_game_votes")
    .select("session_id, status, closes_at, settled_at, summary")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (isMissingSchema(error)) return { enabled: false, tribunal: null }
  if (error) throw new Error(error.message)
  if (!data) return { enabled: true, tribunal: null }

  const row = data as Pick<VoteRow, "session_id" | "status" | "closes_at" | "settled_at" | "summary">
  const recent = row.status === "open" || (!!row.settled_at && Date.now() - Date.parse(row.settled_at) < RECENT_VERDICT_MS)
  if (!recent) return { enabled: true, tribunal: null }

  return {
    enabled: true,
    tribunal: {
      sessionId: row.session_id,
      status: row.status,
      closesAt: row.closes_at,
      settledAt: row.settled_at,
      mvpNames: row.summary?.mvp?.names ?? [],
      interNames: row.summary?.inter?.names ?? [],
    },
  }
}
