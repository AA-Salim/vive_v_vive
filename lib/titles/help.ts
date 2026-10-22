import { FREE, pts, type HelpEntry } from "@/lib/help"
import { MILESTONES } from "@/lib/milestones"
import { CATEGORY_META, isCurseCategory, seededPrice, tierOf } from "@/lib/titles/catalog"
import { EFFECT_KEYS, titleEffects, type TitleEffectLine } from "@/lib/titles/effects"
import { FACTION_REASON, LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL, TITLE_CONFLICTS, slotOf, type LoadoutSlot } from "@/lib/titles/loadout"
import { WIN_RATE_MIN_GAMES } from "@/lib/titles/milestone-stats"
import { actAwardKind, isConsolationTitle } from "@/lib/titles/perks"
import { HAND_KISS_NOTE, TIER_LABEL, multiplierLabel, type PriceTier } from "@/lib/titles/pricing"
import {
  CURSE_GAMES,
  DIGNITY_MULTIPLIER,
  MAX_ACTIVE_CURSES,
  MIN_STAKE,
  PERK_CAP,
  PERK_PENALTY_CAP,
  USER_PERK_CAP,
  dignityCost,
} from "@/lib/titles/rules"
import type { PerkInfo, TitleCategory } from "@/lib/titles/types"

// Bubble copy for titles, built from the perk table, the effect table and the rules, never retyped.

export interface CurseFacts {
  bestowedBy?: string | null
  gamesLeft?: number | null
  dignityCost?: number | null
}

export interface TitleHelpInput {
  name: string
  category: string
  perk: PerkInfo | null
  price?: number | null
  curse?: CurseFacts | null
  // Who bears a brand, when it is shown on someone's name ("laefo pays...").
  wearer?: string | null
  // Derived from the name, category and price when absent.
  tier?: PriceTier
  for_self?: boolean
  effects?: TitleEffectLine[]
  dignity_cost?: number | null
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)
const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`
const loadoutRule = `Up to ${MAX_EQUIPPED} titles worn at once (${LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")})`

export function involvement(who: "you" | "they"): string {
  return `${who} play, bet ${MIN_STAKE}+, cast a decree or cash a bounty`
}

const CROWN_TRIGGERS = new Set(["crown_falls", "crown_wins"])

function awardCost(name: string): string {
  const milestone = MILESTONES.find((m) => m.title === name)
  if (milestone) return `${FREE}: earned by the milestone "${milestone.description}", never bought`
  if (actAwardKind(name)) return `${FREE}: crowned at the end of an Act, never bought`
  if (isConsolationTitle(name)) return `${FREE}: a consolation prize handed out when an Act closes`
  return `${FREE}: earned, never bought`
}

function priceOf(input: TitleHelpInput): number | null {
  return input.price ?? seededPrice(input.name)
}

function tierFor(input: TitleHelpInput): PriceTier {
  return input.tier ?? tierOf(input.name, input.category, priceOf(input) ?? 0)
}

export function priceLine(tier: PriceTier, price: number): string {
  if (price <= 0) return `${FREE}: earned on the Rift, never bought`
  return `${pts(price)} · ${TIER_LABEL[tier]}, ${multiplierLabel(tier)}`
}

export function conflictsOf(name: string): string[] {
  return TITLE_CONFLICTS.filter((c) => c.titles.includes(name)).map((c) => c.titles.find((t) => t !== name) ?? "")
}

function effectsOf(input: TitleHelpInput): TitleEffectLine[] {
  return input.effects ?? titleEffects(input.name)
}

function stackingOf(effects: TitleEffectLine[]): string {
  return effects.map((e) => sentence(e.stacking)).join(" ")
}

function perkReward(perk: PerkInfo): string {
  const cap = Math.min(perk.cap, PERK_CAP)
  const base = `Up to ${pts(cap)} per game, paid automatically after it`
  return perk.downside ? `${base}. A bad roll can cost you ${pts(Math.min(perk.downside, PERK_PENALTY_CAP))}` : base
}

function curseHelp(input: TitleHelpInput): HelpEntry {
  const price = priceOf(input)
  const tier = tierFor(input)
  const perk = input.perk
  const facts = input.curse
  const effects = effectsOf(input)
  const buyback = facts?.dignityCost ?? input.dignity_cost ?? (price !== null ? dignityCost(price) : null)
  const branded = facts?.bestowedBy ? `Branded by ${facts.bestowedBy}. ` : ""
  const burnOff = buyback !== null ? ` Dignity buyback: ${pts(buyback)} (${DIGNITY_MULTIPLIER}x the price) burns it early.` : ""
  const now = effects.length ? ` While it burns: ${effects.map((e) => sentence(e.text)).join(" ")}` : ""
  const stacking = effects.length ? ` ${stackingOf(effects)}` : ""
  const priced = price !== null && price > 0 ? `${priceLine(tier, price)}. ${HAND_KISS_NOTE}` : null

  if (!perk) {
    return {
      title: input.name,
      does: `${branded}A brand that has burnt out: a scar, not a curse. It costs nothing any more.`,
      cost: priced ? `${priced} To bestow on someone else` : FREE,
      limits: `A brand burns for ${games(CURSE_GAMES)}, then goes cold.`,
    }
  }

  const cap = pts(Math.min(perk.cap, PERK_CAP))
  if (facts) {
    const left = typeof facts.gamesLeft === "number" ? `${facts.gamesLeft} of ${CURSE_GAMES} games left. ` : ""
    return {
      title: input.name,
      does: `${branded}${sentence(perk.summary)}${now}`,
      cost: `Up to ${cap} per game for ${input.wearer ?? "the wearer"}, until it burns out`,
      reward: `${facts.bestowedBy ?? "The bestower"} collects every point as tribute`,
      limits: `${left}Bites only in games where ${involvement("they")}. Never takes a slot.${stacking}${burnOff}`,
    }
  }

  return {
    title: input.name,
    does: `A curse you buy for someone else. ${sentence(perk.summary)}${now} It marks their name everywhere for ${games(CURSE_GAMES)}.`,
    cost: priced ? `${priced} Bestowed once` : "Bought once in the Armory",
    reward: `You collect up to ${cap} per game as tribute, for ${games(CURSE_GAMES)}`,
    limits: `Bites only in games where ${involvement("they")}. ${MAX_ACTIVE_CURSES} brands per subject at most, never in a slot.${stacking}${burnOff}`,
  }
}

function slotLine(slot: LoadoutSlot): string {
  return `Takes one of your ${SLOT_COUNT[slot]} ${SLOT_LABEL[slot]} slots`
}

// Everything a title does and costs, for its bubble.
export function titleHelp(input: TitleHelpInput): HelpEntry {
  const curse = input.for_self === false || isCurseCategory(input.category) || input.perk?.kind === "curse"
  if (curse) return curseHelp(input)

  const award = input.category === "award"
  const price = priceOf(input)
  const tier = tierFor(input)
  const effects = effectsOf(input)
  const cost = award
    ? awardCost(input.name)
    : price !== null && price > 0
      ? `${priceLine(tier, price)}, once. Equipping it is free. ${HAND_KISS_NOTE}`
      : "Bought once in the Armory. Equipping it is free"
  const perk = input.perk
  const crown = (perk && CROWN_TRIGGERS.has(perk.trigger)) || input.category === "rebellion" || input.category === "loyalty"
  const tagline = CATEGORY_META[input.category as TitleCategory]?.tagline
  const now = effects.map((e) => sentence(e.text)).join(" ")
  const slot = slotOf(tier)
  const clashes = conflictsOf(input.name)
  const loadout = [
    slotLine(slot),
    clashes.length ? `Never worn with ${clashes.join(" or ")}` : null,
    (input.category === "rebellion" || input.category === "loyalty") && slot === "super_rare" ? FACTION_REASON : null,
  ]
    .filter(Boolean)
    .map((line) => sentence(line as string))
    .join(" ")
  const stacking = effects.length ? ` ${stackingOf(effects)}` : ""

  if (!perk) {
    return {
      title: input.name,
      does: now ? `While equipped: ${now}` : `Pure prestige: no perk, only bragging rights.${tagline ? ` ${tagline}` : ""}`,
      cost,
      limits: `${loadout}${stacking} Sealed while a game is live.`,
    }
  }

  return {
    title: input.name,
    does: `${now ? `While equipped: ${now} After each game: ` : ""}${sentence(perk.summary)} Your name wears its colors everywhere while it is equipped.`,
    cost,
    reward: perkReward(perk),
    limits: `${loadout}${stacking} Pays after games where ${involvement("you")}. Max ${pts(PERK_CAP)} a game for any title, ${pts(USER_PERK_CAP)} for all your titles together.${
      crown ? " Needs Salaxe in the game; the King cannot cash it on himself." : ""
    } Sealed while a game is live.`,
  }
}

export function effectKeyHelp(key: keyof typeof EFFECT_KEYS, value: number, titles: string[]): HelpEntry {
  const def = EFFECT_KEYS[key]
  return {
    title: def.chip(value),
    does: `${def.describe(value)}.`,
    cost: titles.length ? `From ${titles.join(", ")}` : FREE,
    limits: def.stacking,
  }
}

const CATEGORY_DOES: Record<TitleCategory, string> = {
  rebellion: "Banners for those who stopped kneeling: cheaper decrees against the King, and perks when Salaxe's side falls. Your name burns ember red.",
  loyalty: "Banners for the faithful: better praise, favor and insurance, and perks when Salaxe's side wins. Your name shimmers in royal gold.",
  absurd: "Banners for the main characters of nobody's story: odd effects, odd payouts, and a name in party colors.",
  mockery: "Curses you buy for someone else. They bend the wearer's bets, decrees or stipend, mark their name with a jester's sign, and pay you tribute.",
  award: "Honors earned from milestones and Acts, never sold. Your name gets a laurel.",
}

function priceRange(prices: number[]): string | null {
  const sold = prices.filter((p) => p > 0)
  if (sold.length === 0) return null
  const min = Math.min(...sold)
  const max = Math.max(...sold)
  return min === max ? pts(min) : `${min.toLocaleString("en-US")} to ${pts(max)}`
}

export function categoryHelp(category: TitleCategory, prices: number[]): HelpEntry {
  const range = priceRange(prices)
  const curse = isCurseCategory(category)
  return {
    title: CATEGORY_META[category].label,
    does: CATEGORY_DOES[category],
    cost:
      category === "award"
        ? `${FREE}: earned, never bought`
        : range
          ? `${range}, once${curse ? " per brand" : ". Equipping is free"}. ${HAND_KISS_NOTE}`
          : "Sold in the Armory",
    reward: curse ? `Tribute to you after each of their games, for ${games(CURSE_GAMES)}` : `Up to ${pts(PERK_CAP)} per game, depending on the title`,
    limits: curse
      ? `${MAX_ACTIVE_CURSES} brands per subject, never in a slot. They can buy back their dignity for ${DIGNITY_MULTIPLIER}x the price.`
      : `${loadoutRule}. Perks pay after games where ${involvement("you")}.`,
  }
}

export function hallHelp(prices: number[]): HelpEntry {
  const range = priceRange(prices)
  return {
    title: "The Hall of Titles",
    does: "Buy or earn titles, build a loadout and curse your friends. Titles bend decrees, bets, praise, stipends and duels the moment you act, dress your name everywhere and pay after each game.",
    cost: range ? `Titles cost ${range}. Honors are free. ${HAND_KISS_NOTE}` : "Honors are free, the rest is sold in the Armory",
    reward: `Up to ${pts(USER_PERK_CAP)} per game from your loadout's perks, plus tribute from every brand you bestowed`,
    limits: `${loadoutRule}, sealed while a game is live. Brands burn for ${games(CURSE_GAMES)}.`,
  }
}

export const MILESTONES_HELP: HelpEntry = {
  title: "Milestones",
  does: "Reach a milestone and engrave its title for free. Each one carries a small perk once you equip it, and the decree and devotion families also cut decree prices or raise praise.",
  cost: FREE,
  reward: "A free title with its own perk",
  limits: `Engraved titles stay in your collection for good and take a Common or Rare slot. Win-rate milestones count after ${WIN_RATE_MIN_GAMES} games.`,
}

export function dignityHelp(name: string, cost: number, bestower: string | null, gamesLeft: number): HelpEntry {
  return {
    title: "Buy back your dignity",
    does: `Burns "${name}" off your name now, instead of waiting ${games(gamesLeft)}, and ends its effect on you.`,
    cost: `${pts(cost)} (${DIGNITY_MULTIPLIER}x the brand's price), paid to the Crown`,
    reward: `No more tribute to ${bestower ?? "the bestower"}, and your name is clean of this mark`,
    limits: "No refunds. Sealed while a game is live. The bestower keeps what they spent.",
  }
}
