import type { SupabaseClient } from "@supabase/supabase-js"
import { WINDOW_GRACE_MS, getDecree } from "@/lib/chaos/catalog"
import { buildResponse, enrichActions, loadEntries, type ActionRow, type IssueOutcome } from "@/lib/chaos/entries"
import { parseChaosError } from "@/lib/chaos/errors"
import { planEffect, type Seat } from "@/lib/chaos/legacy-plan"
import { DEFAULT_RULES, decreeCostFor, toBoardAssignments, validateDecree, viewerSeat, type DecreeContext } from "@/lib/chaos/rules"
import { requestSide, requestTargets, type DecreeRequest } from "@/lib/chaos/schema"
import type { DecreeTitles } from "@/lib/chaos/title-terms"
import type { DecreeDetails } from "@/lib/chaos/types"
import { NO_EFFECTS } from "@/lib/titles/effects"
import { loadEffectsFor } from "@/lib/titles/server"
import type { SessionWithAssignments } from "@/lib/types"

// Fallback used only until supabase/phase10_chaos.sql is applied: same rules, but not atomic.

// The caster's titles and every seat's, so the fallback prices decrees like vvv_title_decree_cost().
async function legacyTitles(supabase: SupabaseClient, userId: string, session: SessionWithAssignments): Promise<DecreeTitles> {
  const playerIds = session.session_assignments.map((a) => a.player_id)
  const { data: players } = await supabase.from("players").select("id, auth_user_id").in("id", playerIds)
  const userByPlayer = new Map((players ?? []).map((p) => [p.id as string, (p.auth_user_id as string | null) ?? null]))
  const userIds = [userId, ...[...userByPlayer.values()].filter((id): id is string => !!id)]
  const effects = await loadEffectsFor(supabase, [...new Set(userIds)])
  return {
    actor: effects.get(userId) ?? NO_EFFECTS,
    ofPlayer: (playerId) => effects.get(userByPlayer.get(playerId) ?? "") ?? NO_EFFECTS,
  }
}

const SESSION_SELECT = "*, session_assignments ( *, players:player_id ( id, name ) )"

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
  const titles = await legacyTitles(supabase, userId, session)
  const ctx: DecreeContext = {
    rules: DEFAULT_RULES,
    schema: "legacy",
    actions,
    assignments: toBoardAssignments(session),
    viewer: { userId, playerId: (profile?.player_id as string | null) ?? null, balance: null },
    windowOpen: session.status === "chaos" && (endsAt === null || Date.now() <= endsAt + WINDOW_GRACE_MS),
    titles,
  }

  const invalid = validateDecree(request, ctx)
  if (invalid) return { ok: false, code: invalid }

  const plan = await planEffect(supabase, request, session.session_assignments, ctx)
  if (typeof plan === "string") return { ok: false, code: plan }

  const actionId = crypto.randomUUID()
  const [first, second] = requestTargets(request)
  const price = decreeCostFor(def.type, ctx, { first, second, team: requestSide(request) })
  const cost = price.cost
  const refund = () =>
    supabase.rpc("adjust_balance", { p_user_id: userId, p_amount: cost, p_reason: "chaos_refunded", p_reference_id: actionId })

  const charge = await supabase.rpc("adjust_balance", {
    p_user_id: userId,
    p_amount: -cost,
    p_reason: def.reason,
    p_reference_id: actionId,
  })
  if (charge.error) return { ok: false, code: parseChaosError(charge.error) }

  const applied: Seat[] = []
  const abort = async (): Promise<IssueOutcome> => {
    for (const seat of applied) {
      await supabase
        .from("session_assignments")
        .update({
          lane: seat.lane,
          champion: seat.champion,
          champion_internal: seat.champion_internal,
          fearless_override: seat.fearless_override,
        })
        .eq("id", seat.id)
    }
    await refund()
    return { ok: false, code: "failed" }
  }

  for (const { id, patch } of plan.updates) {
    const { error } = await supabase.from("session_assignments").update(patch).eq("id", id)
    if (error) return abort()
    const seat = session.session_assignments.find((s) => s.id === id)
    if (seat) applied.push(seat)
  }

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
  if (insertError) return abort()

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
  return { ok: true, response: buildResponse(entry, (charge.data as number | null) ?? null, price.notes) }
}
