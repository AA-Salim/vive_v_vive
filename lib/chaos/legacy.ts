import type { SupabaseClient } from "@supabase/supabase-js"
import type { Champion } from "@/lib/champions"
import { getChampionPools } from "@/lib/champions-db"
import { WINDOW_GRACE_MS, getDecree } from "@/lib/chaos/catalog"
import { buildResponse, enrichActions, loadEntries, type ActionRow, type IssueOutcome } from "@/lib/chaos/entries"
import { parseChaosError, type ChaosErrorCode } from "@/lib/chaos/errors"
import {
  DEFAULT_RULES,
  exiledChampions,
  pardonedPlayerIds,
  toBoardAssignments,
  validateDecree,
  viewerSeat,
  type DecreeContext,
} from "@/lib/chaos/rules"
import { requestSide, requestTargets, type DecreeRequest } from "@/lib/chaos/schema"
import type { DecreeChange, DecreeDetails, DecreeSeat } from "@/lib/chaos/types"
import type { Role, SessionWithAssignments, Side } from "@/lib/types"

// Fallback used only until supabase/phase10_chaos.sql is applied: same rules, but not atomic.

const SESSION_SELECT = "*, session_assignments ( *, players:player_id ( id, name ) )"

type Seat = SessionWithAssignments["session_assignments"][number]

interface SeatPatch {
  lane?: Role
  champion?: string
  champion_internal?: string
  fearless_override?: boolean
}

interface EffectPlan {
  updates: Array<{ id: string; patch: SeatPatch }>
  changes: DecreeChange[]
  affectedSide: Side | null
  bannedChampion: string | null
  forcedLane: Role | null
}

type Pools = Record<Role, Champion[]>

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function randomOf<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function pickChampion(pools: Pools, lane: Role, exclude: Set<string>, fearless: Set<string>) {
  const pool = pools[lane] ?? []
  const fresh = pool.filter((c) => !exclude.has(c.name) && !fearless.has(c.name))
  if (fresh.length > 0) return { champion: randomOf(fresh), fearlessOverride: false }
  const any = pool.filter((c) => !exclude.has(c.name))
  if (any.length > 0) return { champion: randomOf(any), fearlessOverride: true }
  return null
}

function seatOf(seat: Seat): DecreeSeat {
  return { lane: seat.lane, champion: seat.champion, champion_internal: seat.champion_internal }
}

function change(seat: Seat, after: DecreeSeat): DecreeChange {
  return {
    assignment_id: seat.id,
    player_id: seat.player_id,
    player_name: seat.players?.name ?? null,
    side: seat.side,
    before: seatOf(seat),
    after,
  }
}

function emptyPlan(): EffectPlan {
  return { updates: [], changes: [], affectedSide: null, bannedChampion: null, forcedLane: null }
}

async function loadReroll(supabase: SupabaseClient) {
  const today = new Date().toISOString().split("T")[0]
  const [pools, { data }] = await Promise.all([
    getChampionPools(),
    supabase.from("daily_fearless").select("champion_name").eq("date", today),
  ])
  const fearless = new Set<string>(((data ?? []) as { champion_name: string }[]).map((r) => r.champion_name))
  return { pools, fearless }
}

async function planEffect(
  supabase: SupabaseClient,
  request: DecreeRequest,
  seats: Seat[],
  ctx: DecreeContext
): Promise<EffectPlan | ChaosErrorCode> {
  const plan = emptyPlan()
  const byPlayer = (playerId: string) => seats.find((s) => s.player_id === playerId) ?? null
  const pardoned = pardonedPlayerIds(ctx.actions)
  const exclude = new Set<string>([...seats.map((s) => s.champion), ...exiledChampions(ctx.actions)])

  const reroll = async (targets: Seat[]) => {
    const { pools, fearless } = await loadReroll(supabase)
    for (const seat of targets) {
      const picked = pickChampion(pools, seat.lane, exclude, fearless)
      if (!picked) return false
      exclude.add(picked.champion.name)
      plan.updates.push({
        id: seat.id,
        patch: {
          champion: picked.champion.name,
          champion_internal: picked.champion.internal,
          fearless_override: picked.fearlessOverride,
        },
      })
      plan.changes.push(
        change(seat, { lane: seat.lane, champion: picked.champion.name, champion_internal: picked.champion.internal })
      )
    }
    return true
  }

  switch (request.action_type) {
    case "double_or_nothing":
    case "royal_pardon":
      return plan
    case "reroll_self": {
      const seatId = viewerSeat(ctx)?.id
      const seat = seats.find((s) => s.id === seatId)
      if (!seat) return "players_only"
      return (await reroll([seat])) ? plan : "no_champion"
    }
    case "champion_ban": {
      const target = byPlayer(request.target_player_id)
      if (!target) return "target_not_in_game"
      plan.bannedChampion = target.champion
      plan.affectedSide = target.side
      return (await reroll([target])) ? plan : "no_champion"
    }
    case "swap_teammate": {
      const seatId = viewerSeat(ctx)?.id
      const mine = seats.find((s) => s.id === seatId)
      const theirs = byPlayer(request.target_player_id)
      if (!mine || !theirs) return "target_not_in_game"
      const take = (s: Seat): SeatPatch => ({
        lane: s.lane,
        champion: s.champion,
        champion_internal: s.champion_internal,
        fearless_override: s.fearless_override,
      })
      plan.updates.push({ id: mine.id, patch: take(theirs) }, { id: theirs.id, patch: take(mine) })
      plan.changes.push(change(mine, seatOf(theirs)), change(theirs, seatOf(mine)))
      return plan
    }
    case "lane_force": {
      const first = byPlayer(request.target_player_id)
      const second = byPlayer(request.target_player_2_id)
      if (!first || !second) return "target_not_in_game"
      plan.updates.push({ id: first.id, patch: { lane: second.lane } }, { id: second.id, patch: { lane: first.lane } })
      plan.changes.push(
        change(first, { ...seatOf(first), lane: second.lane }),
        change(second, { ...seatOf(second), lane: first.lane })
      )
      plan.affectedSide = first.side
      plan.forcedLane = second.lane
      return plan
    }
    case "shuffle_lanes": {
      const movable = shuffled(seats.filter((s) => s.side === request.target_team && !pardoned.has(s.player_id)))
      if (movable.length < 2) return "not_enough_targets"
      movable.forEach((seat, i) => {
        const next = movable[(i + 1) % movable.length]
        plan.updates.push({
          id: seat.id,
          patch: {
            lane: next.lane,
            champion: next.champion,
            champion_internal: next.champion_internal,
            fearless_override: next.fearless_override,
          },
        })
        plan.changes.push(change(seat, seatOf(next)))
      })
      plan.affectedSide = request.target_team
      return plan
    }
    case "reroll_champs": {
      const movable = shuffled(seats.filter((s) => s.side === request.target_team && !pardoned.has(s.player_id)))
      if (movable.length < 1) return "not_enough_targets"
      plan.affectedSide = request.target_team
      return (await reroll(movable)) ? plan : "no_champion"
    }
  }
}

export async function legacyIssueDecree(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  request: DecreeRequest
): Promise<IssueOutcome> {
  const def = getDecree(request.action_type)
  if (!def) return { ok: false, code: "unknown_decree" }
  if (def.requiresV2) return { ok: false, migration: def.name }

  const [{ data: sessionData }, actions, { data: profile }] = await Promise.all([
    supabase.from("game_sessions").select(SESSION_SELECT).eq("id", sessionId).maybeSingle(),
    loadEntries(supabase, sessionId),
    supabase.from("user_profiles").select("player_id").eq("id", userId).maybeSingle(),
  ])
  const session = sessionData as SessionWithAssignments | null
  if (!session) return { ok: false, code: "session_not_found" }

  const endsAt = session.chaos_ends_at ? Date.parse(session.chaos_ends_at) : null
  const ctx: DecreeContext = {
    rules: DEFAULT_RULES,
    schema: "legacy",
    actions,
    assignments: toBoardAssignments(session),
    viewer: { userId, playerId: (profile?.player_id as string | null) ?? null, balance: null },
    windowOpen: session.status === "chaos" && (endsAt === null || Date.now() <= endsAt + WINDOW_GRACE_MS),
  }

  const invalid = validateDecree(request, ctx)
  if (invalid) return { ok: false, code: invalid }

  const plan = await planEffect(supabase, request, session.session_assignments, ctx)
  if (typeof plan === "string") return { ok: false, code: plan }

  const actionId = crypto.randomUUID()
  const cost = def.cost
  const refund = () =>
    supabase.rpc("adjust_balance", { p_user_id: userId, p_amount: cost, p_reason: "chaos_refunded", p_reference_id: actionId })

  const charge = await supabase.rpc("adjust_balance", {
    p_user_id: userId,
    p_amount: -cost,
    p_reason: def.reason,
    p_reference_id: actionId,
  })
  if (charge.error) return { ok: false, code: parseChaosError(charge.error) }

  for (const { id, patch } of plan.updates) {
    const { error } = await supabase.from("session_assignments").update(patch).eq("id", id)
    if (error) {
      await refund()
      return { ok: false, code: "failed" }
    }
  }

  const [first, second] = requestTargets(request)
  const actorPlayerId = viewerSeat(ctx)?.player_id ?? null
  const isTeam = def.targeting === "team"
  const row = {
    id: actionId,
    session_id: sessionId,
    user_id: userId,
    action_type: def.type,
    // The pre-migration constraint only allows medium/high/super, which silently dropped every sabotage row.
    tier: def.dbTier === "sabotage" ? "super" : def.dbTier,
    cost,
    side: request.action_type === "double_or_nothing" ? request.side : null,
    target_player_id: request.action_type === "swap_teammate" || request.action_type === "reroll_self" ? actorPlayerId : first,
    target_player_2_id: request.action_type === "swap_teammate" ? first : second,
    target_team: isTeam ? requestSide(request) : null,
    status: request.action_type === "double_or_nothing" ? ("pending" as const) : ("resolved" as const),
    banned_champion: plan.bannedChampion,
    forced_lane: plan.forcedLane,
  }

  const { error: insertError } = await supabase.from("chaos_actions").insert(row)
  if (insertError) await refund()

  await supabase.from("game_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId)

  const nameFor = (playerId: string | null) => {
    const name = session.session_assignments.find((s) => s.player_id === playerId)?.players?.name
    return name ? { name } : null
  }
  const details: DecreeDetails = { changes: plan.changes }
  if (isTeam || request.action_type === "double_or_nothing") details.side = requestSide(request) ?? undefined
  if (plan.bannedChampion) details.banned_champion = plan.bannedChampion

  const entryRow: ActionRow = {
    ...row,
    payout: null,
    created_at: new Date().toISOString(),
    rules_version: 1,
    affected_side: plan.affectedSide,
    changed_assignment_ids: plan.updates.map((u) => u.id),
    details,
    target_player: nameFor(row.target_player_id),
    target_player_2: nameFor(row.target_player_2_id),
  }
  const [entry] = await enrichActions(supabase, [entryRow])
  return { ok: true, response: buildResponse(entry, (charge.data as number | null) ?? null) }
}
