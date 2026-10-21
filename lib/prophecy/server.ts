import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { emitLive } from "@/lib/live/server"
import { CATEGORIES, type Category } from "@/lib/prophecy/constants"
import { joinNames } from "@/lib/prophecy/lines"
import type {
  Candidate,
  SettledVote,
  TribunalInfo,
  VerdictSummary,
  Viewer,
  WagerStatus,
  WagerView,
} from "@/lib/prophecy/types"
import type { Role, Side } from "@/lib/types"

export interface WagerRow {
  id: string
  session_id: string
  user_id: string
  market: Category
  player_id: string | null
  stake: number
  status: WagerStatus
  payout: number | null
  created_at: string
}

export interface VoteRow {
  session_id: string
  game_id: string | null
  winner_side: Side | null
  status: "open" | "settled"
  opened_at: string
  closes_at: string
  settled_at: string | null
  mvp_player_ids: string[] | null
  inter_player_ids: string[] | null
  summary: Partial<VerdictSummary> | null
}

export interface Profile {
  userId: string
  name: string
  avatarUrl: string | null
  playerId: string | null
}

interface AssignmentRow {
  player_id: string
  side: Side
  lane: Role
  champion: string
  champion_internal: string
  players: { id: string; name: string } | { id: string; name: string }[] | null
}

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
  players: { name?: string } | { name?: string }[] | null
}

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

const MARKET_LABELS: Record<Category, string> = { mvp: "MVP prophecies", inter: "Inter prophecies" }

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadViewer(supabase: SupabaseClient): Promise<Viewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("user_profiles").select("player_id").eq("id", user.id).maybeSingle()
  let playerId = (data?.player_id as string | null | undefined) ?? null
  if (!playerId) {
    const { data: player } = await supabase.from("players").select("id").eq("auth_user_id", user.id).maybeSingle()
    playerId = (player?.id as string | undefined) ?? null
  }
  return { userId: user.id, playerId }
}

export async function loadCandidates(supabase: SupabaseClient, sessionId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("session_assignments")
    .select("player_id, side, lane, champion, champion_internal, players:player_id ( id, name )")
    .eq("session_id", sessionId)
  return ((data ?? []) as AssignmentRow[])
    .map((a) => ({
      playerId: a.player_id,
      name: one(a.players)?.name ?? "Unknown",
      side: a.side,
      lane: a.lane,
      champion: a.champion,
      championInternal: a.champion_internal,
    }))
    .sort((a, b) => (a.side === b.side ? LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane) : a.side === "blue" ? -1 : 1))
}

export async function loadProfiles(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, Profile>> {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from("user_profiles")
    .select("id, discord_username, discord_avatar_url, player_id, players:player_id ( name )")
    .in("id", ids)
  return new Map(
    ((data ?? []) as ProfileRow[]).map((p) => [
      p.id,
      {
        userId: p.id,
        name: one(p.players)?.name || p.discord_username || "Someone",
        avatarUrl: p.discord_avatar_url ?? null,
        playerId: p.player_id ?? null,
      },
    ])
  )
}

export function toWagerView(row: WagerRow, profiles: Map<string, Profile>): WagerView {
  const profile = profiles.get(row.user_id)
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.name ?? "Someone",
    avatarUrl: profile?.avatarUrl ?? null,
    market: row.market,
    playerId: row.player_id,
    stake: row.stake,
    status: row.status,
    payout: row.payout,
    createdAt: row.created_at,
  }
}

export function toTribunalInfo(row: VoteRow): TribunalInfo {
  const summary = row.summary && row.summary.mvp && row.summary.inter ? (row.summary as VerdictSummary) : null
  return {
    status: row.status,
    openedAt: row.opened_at,
    closesAt: row.closes_at,
    settledAt: row.settled_at,
    winnerSide: row.winner_side,
    mvpPlayerIds: row.mvp_player_ids ?? [],
    interPlayerIds: row.inter_player_ids ?? [],
    summary: row.status === "settled" ? summary : null,
  }
}

function announceSettlement(result: SettledVote) {
  const sessionId = result.session_id
  emitLive("vote.closed", {
    sessionId,
    data: { mvpName: joinNames(result.mvp?.names ?? []), interName: joinNames(result.inter?.names ?? []) },
  })
  for (const category of CATEGORIES) {
    const market = result[category]
    if (!market || market.prophets === 0) continue
    emitLive("sidebet.resolved", {
      sessionId,
      data: { market: category, label: MARKET_LABELS[category], winners: market.hits, payout: market.paid },
    })
  }
}

// Lazy settlement: settles every vote whose window closed (exactly once, guarded in SQL) and announces it.
export async function settleDueVotes(supabase: SupabaseClient, sessionId: string | null): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("settle_post_game_votes", { p_session_id: sessionId })
    if (error) return false
    const results = (Array.isArray(data) ? data : []) as SettledVote[]
    results.forEach(announceSettlement)
    return results.length > 0
  } catch {
    return false
  }
}

export async function openTribunal(supabase: SupabaseClient, sessionId: string, gameId: string): Promise<VoteRow | null> {
  try {
    const { data, error } = await supabase.rpc("open_post_game_vote", { p_session_id: sessionId, p_game_id: gameId })
    if (error || !data) return null
    const result = data as { created: boolean; vote: VoteRow }
    if (result.created) emitLive("vote.opened", { sessionId, data: { closesAt: result.vote.closes_at } })
    return result.vote
  } catch {
    return null
  }
}

export async function refundSessionProphecies(supabase: SupabaseClient, sessionId: string): Promise<void> {
  try {
    await supabase.rpc("refund_prophecy_wagers", { p_session_id: sessionId })
  } catch {
    // The settlement sweeper refunds stakes stranded on canceled games.
  }
}

// Lane Calls no longer pay anything; they are only marked so old rows still read as hit or miss.
export async function markLegacyProphecies(
  supabase: SupabaseClient,
  sessionId: string,
  assignments: { player_id: string; lane: Role }[]
): Promise<void> {
  try {
    const { data } = await supabase
      .from("prophecies")
      .select("id, prediction_type, prediction_value")
      .eq("session_id", sessionId)
      .is("correct", null)
    for (const row of (data ?? []) as { id: string; prediction_type: string; prediction_value: Record<string, unknown> }[]) {
      if (row.prediction_type !== "player_gets_lane") continue
      const hit = assignments.some(
        (a) => a.player_id === row.prediction_value.player_id && a.lane === row.prediction_value.lane
      )
      await supabase.from("prophecies").update({ correct: hit }).eq("id", row.id)
    }
  } catch {
    // Display-only bookkeeping.
  }
}

const ERROR_MESSAGES: [string, number, string][] = [
  ["prophecy_auth_required", 401, "Log in with Discord to seal a prophecy."],
  ["prophecy_invalid_market", 400, "Pick MVP or Inter."],
  ["prophecy_invalid_stake", 400, "Stakes go from 10 to 50 points."],
  ["prophecy_session_not_found", 404, "This game no longer exists."],
  ["prophecy_closed", 409, "The prophecy window is closed. The Oracle has stopped taking calls."],
  ["prophecy_player_not_in_game", 400, "That player is not in this game."],
  ["prophecy_self_inter", 400, "You cannot prophesy your own int. The court admires the honesty, though."],
  ["prophecy_already_sealed", 409, "You already sealed a prophecy for this game."],
  ["vote_auth_required", 401, "Log in with Discord to vote."],
  ["vote_invalid_category", 400, "Vote for MVP or Inter."],
  ["vote_not_open", 409, "The tribunal is not in session."],
  ["vote_closed", 409, "The gavel already fell. Ballots are closed."],
  ["vote_player_not_in_game", 400, "That player was not in this game."],
  ["vote_self", 400, "Nice try. You cannot vote for yourself."],
  ["vote_same_player", 400, "You cannot crown and roast the same player."],
  ["Debt limit", 400, "Debt limit reached (-300 max)."],
  ["min_balance", 400, "Debt limit reached (-300 max)."],
  ["User balance not found", 400, "Claim your points first: your treasury is empty."],
]

export function rpcErrorResponse(error: { message?: string }, fallback: string) {
  const message = error.message ?? ""
  const match = ERROR_MESSAGES.find(([key]) => message.includes(key))
  if (match) return NextResponse.json({ error: match[2] }, { status: match[1] })
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function playerName(supabase: SupabaseClient, playerId: string): Promise<string> {
  const { data } = await supabase.from("players").select("name").eq("id", playerId).maybeSingle()
  return (data?.name as string | undefined) ?? "Someone"
}
