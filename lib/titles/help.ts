import { FREE, pts, type HelpEntry } from "@/lib/help"
import { MILESTONES } from "@/lib/milestones"
import { CATEGORY_META, isCurseCategory, seededPrice } from "@/lib/titles/catalog"
import { actAwardKind, isConsolationTitle } from "@/lib/titles/perks"
import { CURSE_GAMES, DIGNITY_MULTIPLIER, MAX_ACTIVE_CURSES, MIN_STAKE, PERK_CAP, PERK_PENALTY_CAP, dignityCost } from "@/lib/titles/rules"
import { WIN_RATE_MIN_GAMES } from "@/lib/titles/milestone-stats"
import type { PerkInfo, TitleCategory } from "@/lib/titles/types"

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
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)
const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`

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

function perkReward(perk: PerkInfo): string {
  const cap = Math.min(perk.cap, PERK_CAP)
  const base = `Up to ${pts(cap)} per game, paid automatically after it`
  return perk.downside ? `${base}. A bad roll can cost you ${pts(Math.min(perk.downside, PERK_PENALTY_CAP))}` : base
}

function curseHelp(input: TitleHelpInput): HelpEntry {
  const price = priceOf(input)
  const perk = input.perk
  const facts = input.curse
  const buyback = facts?.dignityCost ?? (price !== null ? dignityCost(price) : null)
  const branded = facts?.bestowedBy ? `Branded by ${facts.bestowedBy}. ` : ""
  const burnOff = buyback !== null ? ` Dignity buyback: ${pts(buyback)} (${DIGNITY_MULTIPLIER}x the price) burns it early.` : ""

  if (!perk) {
    return {
      title: input.name,
      does: `${branded}A brand that has burnt out: a scar, not a curse. It costs nothing any more.`,
      cost: price !== null ? `${pts(price)} to bestow on someone else` : FREE,
      limits: `A brand burns for ${games(CURSE_GAMES)}, then goes cold.`,
    }
  }

  const cap = pts(Math.min(perk.cap, PERK_CAP))
  if (facts) {
    const left = typeof facts.gamesLeft === "number" ? `${facts.gamesLeft} of ${CURSE_GAMES} games left. ` : ""
    return {
      title: input.name,
      does: `${branded}${sentence(perk.summary)}`,
      cost: `Up to ${cap} per game for ${input.wearer ?? "the wearer"}, until it burns out`,
      reward: `${facts.bestowedBy ?? "The bestower"} collects every point as tribute`,
      limits: `${left}Bites only in games where ${involvement("they")}.${burnOff}`,
    }
  }

  return {
    title: input.name,
    does: `A curse you buy for someone else. ${sentence(perk.summary)} It marks their name everywhere for ${games(CURSE_GAMES)}.`,
    cost: price !== null ? `${pts(price)} to bestow, once` : "Bought once in the Armory",
    reward: `You collect up to ${cap} per game as tribute, for ${games(CURSE_GAMES)}`,
    limits: `Bites only in games where ${involvement("they")}. ${MAX_ACTIVE_CURSES} brands per subject at most.${burnOff}`,
  }
}

// Everything a title does and costs, for its bubble: built from the perk table and the rules, never retyped.
export function titleHelp(input: TitleHelpInput): HelpEntry {
  if (isCurseCategory(input.category) || input.perk?.kind === "curse") return curseHelp(input)

  const award = input.category === "award"
  const price = priceOf(input)
  const cost = award
    ? awardCost(input.name)
    : price !== null
      ? `${pts(price)}, once. Equipping it is free`
      : "Bought once in the Armory. Equipping it is free"
  const perk = input.perk
  const crown = (perk && CROWN_TRIGGERS.has(perk.trigger)) || input.category === "rebellion" || input.category === "loyalty"
  const tagline = CATEGORY_META[input.category as TitleCategory]?.tagline

  if (!perk) {
    return {
      title: input.name,
      does: `Pure prestige: no perk, only bragging rights.${tagline ? ` ${tagline}` : ""}`,
      cost,
      limits: "One banner at a time. Sealed while a game is live.",
    }
  }

  return {
    title: input.name,
    does: `${sentence(perk.summary)} Your name wears its colors everywhere while it is your banner.`,
    cost,
    reward: perkReward(perk),
    limits: `Pays while equipped, after games where ${involvement("you")}. Max ${pts(PERK_CAP)} a game for any title.${
      crown ? " Needs Salaxe in the game; the King cannot cash it on himself." : ""
    } Sealed while a game is live.`,
  }
}

const CATEGORY_DOES: Record<TitleCategory, string> = {
  rebellion: "Banners for those who stopped kneeling: they cash in when Salaxe's side falls. Your name burns ember red.",
  loyalty: "Banners for the faithful: they pay when Salaxe's side wins. Your name shimmers in royal gold.",
  absurd: "Banners for the main characters of nobody's story: odd triggers, odd payouts, and a name in party colors.",
  mockery: "Curses you buy for someone else. Their name gets a jester's mark everywhere and they pay you tribute.",
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
          ? `${range}, once${curse ? " per brand" : ". Equipping is free"}`
          : "Sold in the Armory",
    reward: curse ? `Tribute to you after each of their games, for ${games(CURSE_GAMES)}` : `Up to ${pts(PERK_CAP)} per game, depending on the title`,
    limits: curse
      ? `${MAX_ACTIVE_CURSES} brands per subject. They can buy back their dignity for ${DIGNITY_MULTIPLIER}x the price.`
      : `One banner at a time. Pays after games where ${involvement("you")}.`,
  }
}

export function hallHelp(prices: number[]): HelpEntry {
  const range = priceRange(prices)
  return {
    title: "The Hall of Titles",
    does: "Buy or earn titles, raise one as your banner and curse your friends. Your banner dresses your name everywhere and pays after each game.",
    cost: range ? `Titles cost ${range}. Honors are free` : "Honors are free, the rest is sold in the Armory",
    reward: `Up to ${pts(PERK_CAP)} per game from your banner, plus tribute from every brand you bestowed`,
    limits: `One banner at a time, sealed while a game is live. Brands burn for ${games(CURSE_GAMES)}.`,
  }
}

export const MILESTONES_HELP: HelpEntry = {
  title: "Milestones",
  does: "Reach a milestone and engrave its title for free. Each one carries a small perk once you raise it as your banner.",
  cost: FREE,
  reward: "A free title with its own perk",
  limits: `Engraved titles stay in your collection for good. Win-rate milestones count after ${WIN_RATE_MIN_GAMES} games.`,
}

export function dignityHelp(name: string, cost: number, bestower: string | null, gamesLeft: number): HelpEntry {
  return {
    title: "Buy back your dignity",
    does: `Burns "${name}" off your name now, instead of waiting ${games(gamesLeft)}.`,
    cost: `${pts(cost)} (${DIGNITY_MULTIPLIER}x the brand's price), paid to the Crown`,
    reward: `No more tribute to ${bestower ?? "the bestower"}, and your name is clean of this mark`,
    limits: "No refunds. Sealed while a game is live. The bestower keeps what they spent.",
  }
}
