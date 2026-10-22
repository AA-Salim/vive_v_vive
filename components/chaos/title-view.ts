import { getDecree, type DecreeType } from "@/lib/chaos/catalog"
import { decreeCostFor, decreeUsage, ruleFor, viewerSeat, type DecreeContext } from "@/lib/chaos/rules"
import type { DecreeAim } from "@/lib/chaos/title-terms"
import type { BoardAssignment } from "@/lib/chaos/types"
import type { HelpEntry } from "@/lib/help"
import { isSalaxe } from "@/lib/lore/salaxe"
import { EFFECT_KEYS, effectNotes, fxHas, fxValue } from "@/lib/titles/effects"
import type { Side } from "@/lib/types"
import { chipsHelp, noteChips, type TitleChipModel } from "@/components/chaos/title-chips"

// Decrees that can be aimed at another seat: the ones Kingslayer and Royal Carpet discount.
const AIMED: ReadonlySet<DecreeType> = new Set(["champion_ban", "lane_force", "swap_teammate", "shuffle_lanes", "reroll_champs"])
const TEAM: ReadonlySet<DecreeType> = new Set(["shuffle_lanes", "reroll_champs"])

export function salaxeSeat(ctx: Pick<DecreeContext, "assignments">): BoardAssignment | null {
  return ctx.assignments.find((a) => isSalaxe(a.name)) ?? null
}

function aimableSeats(type: DecreeType, ctx: DecreeContext): BoardAssignment[] {
  if (!AIMED.has(type)) return []
  const mine = viewerSeat(ctx)
  return ctx.assignments.filter((a) => {
    if (mine && a.player_id === mine.player_id) return false
    return type !== "swap_teammate" || (!!mine && a.side === mine.side)
  })
}

function kingslayerApplies(type: DecreeType, ctx: DecreeContext): boolean {
  const king = salaxeSeat(ctx)
  if (!king || !ctx.titles || !fxHas(ctx.titles.actor, "decree_cost_salaxe_pct")) return false
  return aimableSeats(type, ctx).some((a) => a.player_id === king.player_id)
}

export interface DecreeTitleView {
  base: number
  cost: number
  // Applied to every target: the caster's own modifiers.
  chips: TitleChipModel[]
  // Depend on the target or the count: Kingslayer, Royal Carpet, The Usurper, Baron Caller.
  conditional: TitleChipModel[]
  help: HelpEntry | null
}

export function decreeCardTitles(type: DecreeType, ctx: DecreeContext): DecreeTitleView {
  const base = ruleFor(type, ctx.rules).cost
  const titles = ctx.titles
  if (!titles) return { base, cost: base, chips: [], conditional: [], help: null }
  const price = decreeCostFor(type, ctx)
  const chips = noteChips(price.notes, `${type}-own`)
  const conditional: TitleChipModel[] = []
  const { max, base: baseUses } = decreeUsage(type, ctx)
  if (baseUses > 0 && max > baseUses) conditional.push(...noteChips(effectNotes(titles.actor, "decree_extra_uses"), `${type}-uses`))
  if (type === "double_or_nothing" && fxHas(titles.actor, "wager_base_bonus")) {
    conditional.push(...noteChips(effectNotes(titles.actor, "wager_base_bonus"), `${type}-wager`))
  }
  if (kingslayerApplies(type, ctx)) {
    conditional.push(...noteChips(effectNotes(titles.actor, "decree_cost_salaxe_pct"), `${type}-king`))
  }
  for (const seat of aimableSeats(type, ctx)) {
    const fx = titles.ofPlayer(seat.player_id)
    if (fxHas(fx, "decree_cost_target_pct")) {
      conditional.push(...noteChips(effectNotes(fx, "decree_cost_target_pct", seat.name), `${type}-carpet-${seat.id}`))
    }
  }
  const all = [...chips, ...conditional]
  const def = getDecree(type)
  const help = all.length
    ? chipsHelp(def?.name ?? "Royal decree", "Your titles, and the titles of the seats you can aim at, change this decree.", all)
    : null
  return { base, cost: price.cost, chips, conditional, help }
}

export interface DialogPrice {
  base: number
  cost: number
  chips: TitleChipModel[]
}

export function decreeDialogPrice(type: DecreeType, ctx: DecreeContext, aim: DecreeAim | null): DialogPrice {
  const base = ruleFor(type, ctx.rules).cost
  const price = decreeCostFor(type, ctx, aim)
  const chips = noteChips(price.notes, `${type}-dialog`)
  if (ctx.titles) {
    const { used, max, base: baseUses } = decreeUsage(type, ctx)
    if (baseUses > 0 && used >= baseUses && used < max) {
      chips.push(...noteChips(effectNotes(ctx.titles.actor, "decree_extra_uses"), `${type}-dialog-uses`))
    }
    if (type === "double_or_nothing") chips.push(...noteChips(effectNotes(ctx.titles.actor, "wager_base_bonus"), `${type}-dialog-wager`))
  }
  return { base, cost: price.cost, chips }
}

// Chips on a seat in the target picker: what aiming at this seat changes.
export function seatTitleChips(type: DecreeType, seat: BoardAssignment, ctx: DecreeContext): TitleChipModel[] {
  const titles = ctx.titles
  if (!titles || TEAM.has(type) || !aimableSeats(type, ctx).some((a) => a.id === seat.id)) return []
  const chips: TitleChipModel[] = []
  const fx = titles.ofPlayer(seat.player_id)
  if (fxHas(fx, "decree_cost_target_pct")) {
    const value = fxValue(fx, "decree_cost_target_pct")
    const source = fx.get("decree_cost_target_pct")?.sources[0]?.title ?? "Royal Carpet"
    chips.push({
      key: `carpet-${seat.id}`,
      label: `${EFFECT_KEYS.decree_cost_pct.chip(value)} on them`,
      tone: "boon",
      detail: `${source}: ${EFFECT_KEYS.decree_cost_target_pct.applied(value, seat.name)}`,
    })
  }
  if (isSalaxe(seat.name) && kingslayerApplies(type, ctx)) {
    chips.push(...noteChips(effectNotes(titles.actor, "decree_cost_salaxe_pct"), `king-${seat.id}`))
  }
  return chips
}

export function sideTitleChips(type: DecreeType, side: Side, ctx: DecreeContext): TitleChipModel[] {
  const titles = ctx.titles
  if (!titles || !TEAM.has(type)) return []
  const chips: TitleChipModel[] = []
  const king = salaxeSeat(ctx)
  const mine = viewerSeat(ctx)
  if (king && king.side === side && kingslayerApplies(type, ctx)) {
    chips.push(...noteChips(effectNotes(titles.actor, "decree_cost_salaxe_pct"), `king-${side}`))
  }
  const carpet = ctx.assignments.find(
    (a) => a.side === side && a.player_id !== mine?.player_id && fxHas(titles.ofPlayer(a.player_id), "decree_cost_target_pct")
  )
  if (carpet) {
    chips.push(...noteChips(effectNotes(titles.ofPlayer(carpet.player_id), "decree_cost_target_pct", carpet.name), `carpet-${side}`))
  }
  return chips
}
