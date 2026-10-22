import {
  ALL_DECREES,
  DEBT_FLOOR,
  HOSTILE_TYPES,
  WAGER_BASE_MULTIPLIER,
  WAGER_DEFIANCE_STEP,
  WAGER_MAX_DEFIANCE,
  getDecree,
  type DecreeType,
} from "@/lib/chaos/catalog"
import type { ChaosErrorCode } from "@/lib/chaos/errors"
import type { DecreeRequest } from "@/lib/chaos/schema"
import { decreeAimedSeats, decreePrice, seatExileImmune, type DecreeAim, type DecreePrice, type DecreeTitles } from "@/lib/chaos/title-terms"
import { isSalaxe } from "@/lib/lore/salaxe"
import { NO_EFFECTS, WAGER_MAX_MULTIPLIER, decreeMaxUses } from "@/lib/titles/effects"
import type {
  BoardAssignment,
  ChaosDecreeEntry,
  ChaosSchema,
  ChaosViewer,
  DecreeRule,
  DecreeRuleBook,
} from "@/lib/chaos/types"
import type { SessionWithAssignments, Side } from "@/lib/types"

export const DEFAULT_RULES = Object.fromEntries(
  ALL_DECREES.map((d) => [d.type, { cost: d.cost, maxUses: d.maxUses, limitGroup: d.limitGroup, enabled: !d.retired }])
) as DecreeRuleBook

export interface RuleRow {
  action_type: string
  cost: number
  max_uses: number
  limit_group: string
  enabled: boolean
}

export function mergeRules(rows: RuleRow[]): DecreeRuleBook {
  const book = Object.fromEntries(
    ALL_DECREES.map((d) => [d.type, { ...DEFAULT_RULES[d.type], enabled: false }])
  ) as DecreeRuleBook
  for (const row of rows) {
    if (!getDecree(row.action_type)) continue
    book[row.action_type as DecreeType] = {
      cost: row.cost,
      maxUses: row.max_uses,
      limitGroup: row.limit_group,
      enabled: row.enabled,
    }
  }
  return book
}

export interface DecreeContext {
  rules: DecreeRuleBook
  schema: ChaosSchema
  actions: ChaosDecreeEntry[]
  assignments: BoardAssignment[]
  viewer: ChaosViewer | null
  windowOpen: boolean
  // Title effects of the caster and of every seat; absent means no title changes anything.
  titles?: DecreeTitles
}

export type BlockCode = "retired" | "window" | "auth" | "migration" | "disabled" | "players_only" | "limit" | "no_target" | "funds"

export interface DecreeBlock {
  code: BlockCode
  label: string
}

export function sideName(side: Side): string {
  return side === "blue" ? "Blue" : "Red"
}

export function toBoardAssignments(session: SessionWithAssignments): BoardAssignment[] {
  return session.session_assignments.map((sa) => ({
    id: sa.id,
    player_id: sa.player_id,
    name: sa.players?.name ?? "Unknown",
    side: sa.side,
    lane: sa.lane,
    champion: sa.champion,
    champion_internal: sa.champion_internal,
  }))
}

export function liveActions(actions: ChaosDecreeEntry[]): ChaosDecreeEntry[] {
  return actions.filter((a) => a.status !== "refunded")
}

export function pardonedPlayerIds(actions: ChaosDecreeEntry[]): Set<string> {
  return new Set(
    liveActions(actions)
      .filter((a) => a.action_type === "royal_pardon" && a.target_player_id)
      .map((a) => a.target_player_id as string)
  )
}

export function exiledChampions(actions: ChaosDecreeEntry[]): Set<string> {
  return new Set(
    liveActions(actions)
      .map((a) => a.banned_champion)
      .filter((c): c is string => !!c)
  )
}

export function viewerSeat(ctx: Pick<DecreeContext, "viewer" | "assignments">): BoardAssignment | null {
  const playerId = ctx.viewer?.playerId
  if (!playerId) return null
  return ctx.assignments.find((a) => a.player_id === playerId) ?? null
}

export function ruleFor(type: DecreeType, rules: DecreeRuleBook): DecreeRule {
  return rules[type] ?? DEFAULT_RULES[type]
}

// max includes The Usurper's extra use; base is the rule book's own limit.
export function decreeUsage(type: DecreeType, ctx: DecreeContext): { used: number; max: number; base: number } {
  const rule = ruleFor(type, ctx.rules)
  const max = decreeMaxUses(rule.maxUses, ctx.titles?.actor ?? NO_EFFECTS)
  const userId = ctx.viewer?.userId
  if (!userId) return { used: 0, max, base: rule.maxUses }
  const used = liveActions(ctx.actions).filter(
    (a) => a.user_id === userId && ruleFor(a.action_type, ctx.rules).limitGroup === rule.limitGroup
  ).length
  return { used, max, base: rule.maxUses }
}

// What the decree costs this caster once titles have spoken. Without an aim only the caster's own modifiers count
// (the card price); with one, Kingslayer and Royal Carpet join in (the dialog price).
export function decreeCostFor(type: DecreeType, ctx: DecreeContext, aim: DecreeAim | null = null): DecreePrice {
  const base = ruleFor(type, ctx.rules).cost
  if (!ctx.titles) return { cost: base, pct: 0, notes: [] }
  const aimed = aim ? decreeAimedSeats(type, aim, ctx.assignments, ctx.viewer?.playerId ?? null) : []
  return decreePrice(type, base, ctx.titles, aimed, isSalaxe(viewerSeat(ctx)?.name))
}

function movable(side: Side, ctx: DecreeContext): BoardAssignment[] {
  const pardoned = pardonedPlayerIds(ctx.actions)
  return ctx.assignments.filter((a) => a.side === side && !pardoned.has(a.player_id))
}

export function sideBlock(type: DecreeType, side: Side, ctx: DecreeContext): string | null {
  if (type === "double_or_nothing") {
    const seat = viewerSeat(ctx)
    if (seat && seat.side !== side) return `You play for ${sideName(seat.side)}. No treason.`
    const userId = ctx.viewer?.userId
    const other = liveActions(ctx.actions).find(
      (a) => a.user_id === userId && a.action_type === "double_or_nothing" && a.side && a.side !== side
    )
    if (other?.side) return `Your wagers ride on ${sideName(other.side)}`
    return null
  }
  if (type === "shuffle_lanes") return movable(side, ctx).length < 2 ? "Not enough unpardoned seats" : null
  if (type === "reroll_champs") return movable(side, ctx).length < 1 ? "Everyone is pardoned" : null
  return null
}

export function playerBlock(
  type: DecreeType,
  target: BoardAssignment,
  ctx: DecreeContext,
  partner: BoardAssignment | null = null
): string | null {
  const pardoned = pardonedPlayerIds(ctx.actions)
  const isViewer = !!ctx.viewer?.playerId && target.player_id === ctx.viewer.playerId
  switch (type) {
    case "royal_pardon":
      return pardoned.has(target.player_id) ? "Already pardoned" : null
    case "champion_ban":
      if (isViewer) return "That is you"
      if (seatExileImmune(target, ctx.titles)) return "Cannot be exiled"
      return pardoned.has(target.player_id) ? "Pardoned" : null
    case "swap_teammate": {
      const seat = viewerSeat(ctx)
      if (isViewer) return "That is you"
      if (!seat || seat.side !== target.side) return "Other team"
      return pardoned.has(target.player_id) ? "Pardoned" : null
    }
    case "lane_force":
      if (isViewer) return "That is you"
      if (pardoned.has(target.player_id)) return "Pardoned"
      if (partner && partner.id === target.id) return null
      if (partner && partner.side !== target.side) return "Other team"
      return null
    default:
      return "Not a valid target"
  }
}

function hasValidTarget(type: DecreeType, ctx: DecreeContext): boolean {
  const def = getDecree(type)
  if (!def) return false
  switch (def.targeting) {
    case "side":
    case "team":
      return (["blue", "red"] as const).some((side) => sideBlock(type, side, ctx) === null)
    case "self":
      return !!viewerSeat(ctx)
    case "player":
    case "teammate":
      return ctx.assignments.some((a) => playerBlock(type, a, ctx) === null)
    case "two_teammates":
      return (["blue", "red"] as const).some(
        (side) => ctx.assignments.filter((a) => a.side === side && playerBlock(type, a, ctx) === null).length >= 2
      )
  }
}

export function shortfall(type: DecreeType, ctx: DecreeContext, cost = decreeCostFor(type, ctx).cost): number {
  const balance = ctx.viewer?.balance
  if (balance == null) return 0
  return Math.max(0, DEBT_FLOOR - (balance - cost))
}

export function decreeBlock(type: DecreeType, ctx: DecreeContext): DecreeBlock | null {
  const def = getDecree(type)
  if (!def || def.retired) return { code: "retired", label: "Retired" }
  if (!ctx.windowOpen) return { code: "window", label: "Window closed" }
  if (!ctx.viewer) return { code: "auth", label: "Log in to decree" }
  if (def.requiresV2 && ctx.schema !== "v2") return { code: "migration", label: "Awaiting the royal seal" }
  if (!ruleFor(type, ctx.rules).enabled) return { code: "disabled", label: "Suspended by the crown" }
  if (def.playersOnly && !viewerSeat(ctx)) return { code: "players_only", label: "Players only" }
  const { used, max } = decreeUsage(type, ctx)
  if (used >= max) return { code: "limit", label: max > 1 ? `${used} of ${max} used` : "Already issued" }
  if (!hasValidTarget(type, ctx)) return { code: "no_target", label: "No valid target" }
  const missing = shortfall(type, ctx)
  if (missing > 0) return { code: "funds", label: `Need ${missing} more` }
  return null
}

export function goesIntoDebt(type: DecreeType, ctx: DecreeContext, cost = decreeCostFor(type, ctx).cost): boolean {
  const balance = ctx.viewer?.balance
  return balance != null && balance - cost < 0
}

// Baron Caller's starting multiplier is stored on the wager when it is placed (chaos_wager_multiplier in SQL).
export function wagerMultiplier(wager: ChaosDecreeEntry, actions: ChaosDecreeEntry[]): number {
  if (wager.rules_version < 2) return WAGER_BASE_MULTIPLIER
  const base = Number(wager.details?.base_multiplier) || WAGER_BASE_MULTIPLIER
  const placedAt = Date.parse(wager.created_at)
  const hits = actions.filter(
    (h) =>
      h.status === "resolved" &&
      h.affected_side === wager.side &&
      h.user_id !== wager.user_id &&
      HOSTILE_TYPES.has(h.action_type) &&
      Date.parse(h.created_at) > placedAt
  ).length
  return Math.min(WAGER_MAX_MULTIPLIER, base + WAGER_DEFIANCE_STEP * Math.min(WAGER_MAX_DEFIANCE, hits))
}

export function validateDecree(request: DecreeRequest, ctx: DecreeContext): ChaosErrorCode | null {
  const type = request.action_type
  const def = getDecree(type)
  if (!ctx.windowOpen) return "window_closed"
  if (!ctx.viewer) return "not_authenticated"
  if (!def) return "unknown_decree"
  if (def.retired) return "retired_decree"
  if (!ruleFor(type, ctx.rules).enabled) return "unknown_decree"
  const { used, max } = decreeUsage(type, ctx)
  if (used >= max) return "limit_reached"

  const seat = viewerSeat(ctx)
  const pardoned = pardonedPlayerIds(ctx.actions)
  const find = (playerId: string) => ctx.assignments.find((a) => a.player_id === playerId) ?? null

  switch (request.action_type) {
    case "double_or_nothing": {
      if (seat && seat.side !== request.side) return "treason"
      const userId = ctx.viewer.userId
      const split = liveActions(ctx.actions).some(
        (a) => a.user_id === userId && a.action_type === "double_or_nothing" && a.side !== request.side
      )
      return split ? "fence_sitter" : null
    }
    case "royal_pardon": {
      const target = find(request.target_player_id)
      if (!target) return "target_not_in_game"
      return pardoned.has(target.player_id) ? "already_pardoned" : null
    }
    case "reroll_self":
      return seat ? null : "players_only"
    case "swap_teammate": {
      if (!seat) return "players_only"
      const target = find(request.target_player_id)
      if (!target) return "target_not_in_game"
      if (target.id === seat.id) return "self_target"
      if (target.side !== seat.side) return "target_not_teammate"
      return pardoned.has(target.player_id) ? "target_pardoned" : null
    }
    case "champion_ban": {
      const target = find(request.target_player_id)
      if (!target) return "target_not_in_game"
      if (seat && target.id === seat.id) return "self_target"
      if (pardoned.has(target.player_id)) return "target_pardoned"
      return seatExileImmune(target, ctx.titles) ? "exile_immune" : null
    }
    case "lane_force": {
      const first = find(request.target_player_id)
      const second = find(request.target_player_2_id)
      if (!first || !second) return "target_not_in_game"
      if (first.id === second.id) return "same_target"
      if (first.side !== second.side) return "target_not_teammate"
      if (seat && (first.id === seat.id || second.id === seat.id)) return "self_target"
      return pardoned.has(first.player_id) || pardoned.has(second.player_id) ? "target_pardoned" : null
    }
    case "shuffle_lanes":
    case "reroll_champs": {
      const needed = request.action_type === "shuffle_lanes" ? 2 : 1
      return movable(request.target_team, ctx).length < needed ? "not_enough_targets" : null
    }
  }
}
