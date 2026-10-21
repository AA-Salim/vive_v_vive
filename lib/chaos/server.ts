import type { SupabaseClient } from "@supabase/supabase-js"
import { getDecree } from "@/lib/chaos/catalog"
import { ACTION_SELECT, buildResponse, enrichActions, loadEntries, type ActionRow, type IssueOutcome } from "@/lib/chaos/entries"
import { parseChaosError } from "@/lib/chaos/errors"
import { legacyIssueDecree } from "@/lib/chaos/legacy"
import { DEFAULT_RULES, mergeRules, type RuleRow } from "@/lib/chaos/rules"
import { requestSide, requestTargets, type DecreeRequest } from "@/lib/chaos/schema"
import type { ChaosBoard, ChaosSchema, DecreeDetails, DecreeRuleBook, DecreeStatus } from "@/lib/chaos/types"
import { isMissingSchema } from "@/lib/db-errors"
import type { Role, Side } from "@/lib/types"

export async function loadRules(supabase: SupabaseClient): Promise<{ schema: ChaosSchema; rules: DecreeRuleBook }> {
  const { data, error } = await supabase
    .from("chaos_decree_rules")
    .select("action_type, cost, max_uses, limit_group, enabled")
  if (error) {
    if (isMissingSchema(error)) return { schema: "legacy", rules: DEFAULT_RULES }
    throw new Error(error.message)
  }
  return { schema: "v2", rules: mergeRules((data ?? []) as RuleRow[]) }
}

export async function loadBoard(supabase: SupabaseClient, sessionId: string): Promise<ChaosBoard> {
  const [{ data: auth }, actions, { schema, rules }] = await Promise.all([
    supabase.auth.getUser(),
    loadEntries(supabase, sessionId),
    loadRules(supabase),
  ])

  const user = auth.user
  let viewer: ChaosBoard["viewer"] = null
  if (user) {
    const [{ data: profile }, { data: purse }] = await Promise.all([
      supabase.from("user_profiles").select("player_id").eq("id", user.id).maybeSingle(),
      supabase.from("point_balances").select("balance").eq("user_id", user.id).maybeSingle(),
    ])
    viewer = {
      userId: user.id,
      playerId: (profile?.player_id as string | null) ?? null,
      balance: (purse?.balance as number | null) ?? null,
    }
  }

  return { sessionId, schema, rules, actions, viewer }
}

interface DecreeRpcResult {
  id: string
  action_type: string
  cost: number
  status: DecreeStatus
  balance: number | null
  side: Side | null
  affected_side: Side | null
  target_player_id: string | null
  target_player_2_id: string | null
  banned_champion: string | null
  forced_lane: Role | null
  changed_assignment_ids: string[]
  details: DecreeDetails
  created_at: string
}

function rowFromRpc(result: DecreeRpcResult, sessionId: string, userId: string): ActionRow {
  const def = getDecree(result.action_type)
  const isTeam = def?.targeting === "team"
  return {
    id: result.id,
    session_id: sessionId,
    user_id: userId,
    action_type: result.action_type,
    tier: def?.dbTier ?? "super",
    cost: result.cost,
    side: isTeam ? null : result.side,
    target_player_id: result.target_player_id,
    target_player_2_id: result.target_player_2_id,
    target_team: isTeam ? result.side : null,
    payout: null,
    status: result.status,
    created_at: result.created_at,
    banned_champion: result.banned_champion,
    forced_lane: result.forced_lane,
    rules_version: 2,
    affected_side: result.affected_side,
    changed_assignment_ids: result.changed_assignment_ids,
    details: result.details,
  }
}

export async function issueDecree(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  request: DecreeRequest
): Promise<IssueOutcome> {
  const [first, second] = requestTargets(request)
  const { data, error } = await supabase.rpc("chaos_issue_decree", {
    p_session_id: sessionId,
    p_action_type: request.action_type,
    p_side: requestSide(request),
    p_target_player_id: first,
    p_target_player_2_id: second,
  })

  if (error) {
    if (isMissingSchema(error)) return legacyIssueDecree(supabase, sessionId, userId, request)
    return { ok: false, code: parseChaosError(error) }
  }

  const result = data as DecreeRpcResult
  const { data: row } = await supabase.from("chaos_actions").select(ACTION_SELECT).eq("id", result.id).maybeSingle()
  const [entry] = await enrichActions(supabase, [(row as ActionRow | null) ?? rowFromRpc(result, sessionId, userId)])
  return { ok: true, response: buildResponse(entry, result.balance ?? null) }
}
