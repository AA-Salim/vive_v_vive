import {
  BOARD_DECREES,
  DEBT_FLOOR,
  TARGETING_LABELS,
  WAGER_BASE_MULTIPLIER,
  WAGER_DEFIANCE_STEP,
  WAGER_MAX_MULTIPLIER,
  getDecree,
  type DecreeType,
} from "@/lib/chaos/catalog"
import { decreeCostFor, decreeUsage, ruleFor, type DecreeContext } from "@/lib/chaos/rules"
import type { ChaosSchema, DecreeRuleBook } from "@/lib/chaos/types"
import { FREE, pts, ptsRange, type HelpEntry } from "@/lib/help"
import { BETTING_DURATION_MS, CHAOS_DURATION_MS } from "@/lib/session/constants"
import { durationLabel } from "@/components/session/help"

const WAGER: DecreeType = "double_or_nothing"
const WAGER_TOP_MULTIPLIER = WAGER_MAX_MULTIPLIER
const wagerName = getDecree(WAGER)?.name ?? "The King's Wager"
const wagerRef = wagerName.replace(/^The\b/, "the")

export function wagerPayouts(stake: number) {
  return {
    base: Math.floor(stake * WAGER_BASE_MULTIPLIER),
    top: Math.floor(stake * WAGER_TOP_MULTIPLIER),
  }
}

function wagerReward(stake: number, schema: ChaosSchema): string {
  const { base, top } = wagerPayouts(stake)
  const lead = `${pts(base)} (${WAGER_BASE_MULTIPLIER}x) if your side wins`
  const defiance =
    schema === "v2"
      ? `. Every hostile decree someone else lands on that side afterwards adds +${WAGER_DEFIANCE_STEP}x, capped at ${pts(top)} (${WAGER_TOP_MULTIPLIER}x)`
      : ""
  return `${lead}${defiance}. Lose and the treasury keeps the stake; a canceled game refunds it.`
}

function usesLine(type: DecreeType, ctx: DecreeContext): string {
  const rule = ruleFor(type, ctx.rules)
  const { used, max } = decreeUsage(type, ctx)
  const shared = BOARD_DECREES.filter(
    (d) => d.type !== type && ruleFor(d.type, ctx.rules).limitGroup === rule.limitGroup
  ).map((d) => d.name)
  const base = max === 1 ? "Once per game" : `Up to ${max} per game`
  const sharing = shared.length > 0 ? `, shared with ${shared.join(" and ")}` : ""
  const left = ctx.viewer ? ` (${Math.max(0, max - used)} left for you)` : ""
  return `${base}${sharing}${left}.`
}

export function decreeHelp(type: DecreeType, ctx: DecreeContext): HelpEntry | null {
  const def = getDecree(type)
  if (!def) return null
  const base = ruleFor(type, ctx.rules).cost
  const cost = decreeCostFor(type, ctx).cost
  const isWager = type === WAGER
  const shielded = !isWager && type !== "royal_pardon" && def.targeting !== "self"

  const limits = [
    `Target: ${TARGETING_LABELS[def.targeting].toLowerCase()}.`,
    usesLine(type, ctx),
    isWager
      ? "Players can only back their own team, and all your wagers in a game ride on one side."
      : def.playersOnly
        ? "Only players in this game can cast it."
        : "Spectators can cast it too.",
    shielded ? "Pardoned players are immune." : null,
    "Decree window only.",
  ]

  return {
    title: def.name,
    does: isWager ? def.short : ctx.schema === "v2" ? def.effect : (def.legacyEffect ?? def.effect),
    cost: `${pts(cost)}${cost !== base ? ` (${pts(base)} before your titles)` : ""}, paid when you seal it`,
    reward: isWager ? wagerReward(cost, ctx.schema) : `Nothing back: the chaos is the prize. A canceled game refunds all ${pts(cost)}.`,
    limits: limits.filter(Boolean).join(" "),
  }
}

export function wagerHelp(rules: DecreeRuleBook, schema: ChaosSchema): HelpEntry {
  const rule = ruleFor(WAGER, rules)
  return {
    title: "Your wagers",
    does: "What your open wagers pay if the side you backed wins, at their current multiplier.",
    cost: `${pts(rule.cost)} per wager`,
    reward: wagerReward(rule.cost, schema),
    limits: `Up to ${rule.maxUses} per game, all on one side. Players can only back their own team.`,
  }
}

export function decreesPanelHelp(rules: DecreeRuleBook, schema: ChaosSchema): HelpEntry {
  const live = BOARD_DECREES.filter((d) => ruleFor(d.type, rules).enabled)
  const costs = live.map((d) => ruleFor(d.type, rules).cost)
  const others = live.filter((d) => d.type !== WAGER)
  const wagerUses = ruleFor(WAGER, rules).maxUses
  const usage = others.every((d) => ruleFor(d.type, rules).maxUses === 1)
    ? `${wagerName} up to ${wagerUses} times per game, every other decree once.`
    : "Each decree has its own limit per game, shown in its bubble."
  return {
    title: "Royal Decrees",
    does: "Spend points to bend the draft before the game: reroll champions, swap lanes, shield a friend or back a side. Every decree is public and final.",
    cost: costs.length > 0 ? `${ptsRange(Math.min(...costs), Math.max(...costs))} per decree` : "Nothing is on sale right now",
    reward: `Only ${wagerRef} pays back, up to ${schema === "v2" ? WAGER_TOP_MULTIPLIER : WAGER_BASE_MULTIPLIER}x its stake. A canceled game refunds every decree in full.`,
    limits: `${usage} You can spend into debt down to ${DEBT_FLOOR} points.`,
  }
}

export const DECREE_WINDOW_HELP: HelpEntry = {
  title: "The decree window",
  does: `Decrees can only be sealed while this window is open: ${durationLabel(CHAOS_DURATION_MS)} from the moment the host starts the game.`,
  cost: FREE,
  limits: `The host or an admin can close it early. Once it closes, betting opens for ${durationLabel(BETTING_DURATION_MS)}.`,
}

export const PURSE_HELP: HelpEntry = {
  title: "Your purse",
  does: "Your points. Every decree is paid from it the moment you seal it.",
  cost: FREE,
  limits: `You can spend into debt down to ${DEBT_FLOOR} points. While in debt, each decree asks you to type a pledge of allegiance first.`,
}

export const LEDGER_HELP: HelpEntry = {
  title: "Decree ledger",
  does: "Every decree sealed this game, newest first: who cast it, on whom, and what changed.",
  cost: FREE,
  limits: "Open wagers show their live multiplier and payout. Refunded decrees are struck through.",
}
