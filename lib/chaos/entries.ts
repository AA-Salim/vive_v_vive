import type { SupabaseClient } from "@supabase/supabase-js"
import { getDecree, type DecreeType } from "@/lib/chaos/catalog"
import type { ChaosErrorCode } from "@/lib/chaos/errors"
import { decreeHeadline } from "@/lib/chaos/format"
import { wagerMultiplier } from "@/lib/chaos/rules"
import type { ChaosDecreeEntry, DecreeDetails, DecreeResponse, DecreeStatus } from "@/lib/chaos/types"
import type { Role, Side } from "@/lib/types"

type Named = { name: string } | { name: string }[] | null | undefined

export interface ActionRow {
  id: string
  session_id: string
  user_id: string
  action_type: string
  tier: string
  cost: number
  side: Side | null
  target_player_id: string | null
  target_player_2_id: string | null
  target_team: Side | null
  payout: number | null
  status: DecreeStatus
  created_at: string
  banned_champion?: string | null
  forced_lane?: Role | null
  rules_version?: number | null
  affected_side?: Side | null
  changed_assignment_ids?: string[] | null
  details?: DecreeDetails | null
  multiplier?: number | string | null
  target_player?: Named
  target_player_2?: Named
}

interface ProfileRow {
  id: string
  discord_username: string | null
  discord_avatar_url: string | null
  player_id: string | null
  players?: Named
}

export type IssueOutcome =
  | { ok: true; response: DecreeResponse }
  | { ok: false; code: ChaosErrorCode }
  | { ok: false; migration: string }

export const ACTION_SELECT = "*, target_player:target_player_id ( name ), target_player_2:target_player_2_id ( name )"

function nameOf(value: Named): string | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0]?.name ?? null) : value.name
}

function withWagerOdds(entry: ChaosDecreeEntry, all: ChaosDecreeEntry[]): ChaosDecreeEntry {
  if (entry.action_type !== "double_or_nothing") return entry
  if (entry.status === "pending") {
    const multiplier = wagerMultiplier(entry, all)
    return { ...entry, multiplier, potential_payout: Math.floor(entry.cost * multiplier) }
  }
  if (entry.status === "won") {
    const payout = entry.payout ?? entry.cost * 2
    return { ...entry, multiplier: entry.multiplier ?? payout / Math.max(1, entry.cost), potential_payout: payout }
  }
  return entry
}

export async function enrichActions(supabase: SupabaseClient, rows: ActionRow[]): Promise<ChaosDecreeEntry[]> {
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const profiles = new Map<string, ProfileRow>()
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, discord_username, discord_avatar_url, player_id, players:player_id ( name )")
      .in("id", userIds)
    for (const p of (data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  }

  const entries: ChaosDecreeEntry[] = rows
    .filter((r) => !!getDecree(r.action_type))
    .map((r) => {
      const profile = profiles.get(r.user_id)
      const username = profile?.discord_username ?? "Unknown"
      return {
        id: r.id,
        session_id: r.session_id,
        user_id: r.user_id,
        action_type: r.action_type as DecreeType,
        tier: r.tier,
        cost: r.cost,
        side: r.side,
        target_player_id: r.target_player_id,
        target_player_2_id: r.target_player_2_id,
        target_team: r.target_team,
        payout: r.payout,
        status: r.status,
        created_at: r.created_at,
        banned_champion: r.banned_champion ?? null,
        forced_lane: r.forced_lane ?? null,
        discord_username: username,
        discord_avatar_url: profile?.discord_avatar_url ?? null,
        target_player_name: nameOf(r.target_player),
        target_player_2_name: nameOf(r.target_player_2),
        actor_name: nameOf(profile?.players) ?? username,
        actor_player_id: profile?.player_id ?? null,
        rules_version: r.rules_version ?? 1,
        affected_side: r.affected_side ?? null,
        changed_assignment_ids: r.changed_assignment_ids ?? [],
        details: r.details ?? {},
        multiplier: r.multiplier == null ? null : Number(r.multiplier),
        potential_payout: null,
      }
    })

  return entries.map((entry) => withWagerOdds(entry, entries))
}

export async function loadEntries(supabase: SupabaseClient, sessionId: string): Promise<ChaosDecreeEntry[]> {
  const { data, error } = await supabase
    .from("chaos_actions")
    .select(ACTION_SELECT)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return enrichActions(supabase, (data ?? []) as ActionRow[])
}

export function buildResponse(entry: ChaosDecreeEntry, balance: number | null): DecreeResponse {
  return {
    success: true,
    decree: entry,
    balance,
    headline: decreeHeadline(entry),
    changedAssignmentIds: entry.changed_assignment_ids,
    changedPlayerIds: [...new Set((entry.details.changes ?? []).map((c) => c.player_id))],
  }
}
