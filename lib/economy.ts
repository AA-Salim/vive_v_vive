import { BET_RULES } from "@/lib/betting/rules"
import { BOUNTY_RULES, PILLORY_RULES } from "@/lib/bounties/rules"
import { BOARD_DECREES, WAGER_BASE_MULTIPLIER, WAGER_DEFIANCE_STEP, WAGER_MAX_DEFIANCE, getDecree } from "@/lib/chaos/catalog"
import { DUEL_RULES } from "@/lib/duels/rules"
import { FREE, pts, ptsRange, type HelpEntry } from "@/lib/help"
import { DAILY_STIPEND } from "@/lib/lore/daily"
import { CROWNS_PER_DAY, PRAISE_MAX_CHARS, PRAISE_REWARD, ROYAL_FAVOR } from "@/lib/praise/rules"
import { MIN_VOTES_FOR_VERDICT, MVP_BONUS, STAKE_MAX, STAKE_MIN } from "@/lib/prophecy/constants"
import { reasonLabel, reasonMeta, type ReasonGroup } from "@/lib/reasons"
import { GAME_PARTICIPATION_POINTS, GAME_WIN_POINTS } from "@/lib/session/constants"
import { CURSE_GAMES, DIGNITY_MULTIPLIER, MAX_ACTIVE_CURSES, MIN_STAKE, PERK_CAP, PERK_PENALTY_CAP } from "@/lib/titles/rules"

// Every feature checks the same floor: nothing that would take a purse below it goes through.
export const DEBT_FLOOR = BET_RULES.debtFloor

export type EconomyFlow = "earn" | "risk" | "spend"

export type EconomyKey =
  | "starting_purse"
  | "daily_stipend"
  | "game_played"
  | "victory"
  | "praise"
  | "royal_favor"
  | "mvp"
  | "title_perks"
  | "act_honors"
  | "wagers"
  | "guardian_angel"
  | "kings_wager"
  | "prophecies"
  | "duels"
  | "bounties"
  | "decrees"
  | "pillory"
  | "titles"
  | "brands"

export interface EconomyEntry {
  key: EconomyKey
  group: ReasonGroup
  flow: EconomyFlow
  // The figure shown on the row, e.g. "+10" or "49-139".
  amount: string
  // Called out in the overview: the best free deal in the kingdom.
  featured?: boolean
  help: HelpEntry
}

export interface PriceRange {
  min: number
  max: number
}

// Values only the server knows: the active act's purse and the live title shop.
export interface EconomyContext {
  startingPurse?: number | null
  titlePrices?: PriceRange | null
  brandPrices?: PriceRange | null
}

export const FLOW_LABELS: Record<EconomyFlow, { title: string; blurb: string }> = {
  earn: { title: "Where points come from", blurb: "Free income. Show up, play, sing." },
  risk: { title: "Stake it to make it", blurb: "Put points up, win more back. Or do not." },
  spend: { title: "Where points go", blurb: "Pure spending. Chaos, vanity and grudges." },
}

const plus = (n: number) => `+${n.toLocaleString("en-US")}`
const span = (range: PriceRange) => (range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`)
export const rangeOf = (values: number[]): PriceRange => ({ min: Math.min(...values), max: Math.max(...values) })

const DECREE_COSTS = rangeOf(BOARD_DECREES.map((d) => d.cost))
const SABOTAGE_NAMES = BOARD_DECREES.filter((d) => d.tier === "sabotage").map((d) => d.name)
const KINGS_WAGER_COST = getDecree("double_or_nothing")?.cost ?? DECREE_COSTS.min
const WAGER_MAX_MULTIPLIER = WAGER_BASE_MULTIPLIER + WAGER_DEFIANCE_STEP * WAGER_MAX_DEFIANCE
const FLOOR_RULE = `Nothing goes through if it would leave you below ${DEBT_FLOOR}.`

export function economyEntries(ctx: EconomyContext = {}): EconomyEntry[] {
  const purse = ctx.startingPurse ?? null
  const titles = ctx.titlePrices ?? null
  const brands = ctx.brandPrices ?? null

  return [
    {
      key: "starting_purse",
      group: "treasury",
      flow: "earn",
      amount: purse !== null ? plus(purse) : "Per act",
      help: {
        title: "Starting purse",
        does: "Every act wipes every purse to zero and hands each noble the same starting purse. Join mid-act and it lands on your first visit.",
        cost: FREE,
        reward: purse !== null ? `${pts(purse)}, once per act` : "Set by the Crown for each act, paid once",
        limits: "Debts die with the act too. Only Hall of Fame bonuses carry over.",
      },
    },
    {
      key: "daily_stipend",
      group: "treasury",
      flow: "earn",
      amount: plus(DAILY_STIPEND),
      help: {
        title: "Daily stipend",
        does: "The exiled King's daily alms, paid the first time you open the app each day.",
        cost: FREE,
        reward: `${pts(DAILY_STIPEND)} a day`,
        limits: "Once a day, signed in.",
      },
    },
    {
      key: "game_played",
      group: "games",
      flow: "earn",
      amount: plus(GAME_PARTICIPATION_POINTS),
      help: {
        title: "Game played",
        does: "Wages for a shift on the Rift: every player of a declared game gets paid, win or lose.",
        cost: FREE,
        reward: `${pts(GAME_PARTICIPATION_POINTS)} a game`,
        limits: "Only for a claimed player seated in the game. Canceled games pay nothing.",
      },
    },
    {
      key: "victory",
      group: "games",
      flow: "earn",
      amount: plus(GAME_WIN_POINTS),
      help: {
        title: "Victory",
        does: "Every player on the winning side gets paid, on top of the game wage.",
        cost: FREE,
        reward: `${pts(GAME_WIN_POINTS)} a win, so ${pts(GAME_WIN_POINTS + GAME_PARTICIPATION_POINTS)} with the wage`,
        limits: "Only for a claimed player seated in the game.",
      },
    },
    {
      key: "praise",
      group: "devotion",
      flow: "earn",
      amount: plus(PRAISE_REWARD),
      featured: true,
      help: {
        title: "Sing His Praises",
        does: "Solve the King's Riddle, then sing Salaxe one short line of worship in the match room. The biggest free payout in the kingdom.",
        cost: FREE,
        reward: `${pts(PRAISE_REWARD)} a day, plus ${pts(ROYAL_FAVOR)} if he crowns it`,
        limits: `One a day, ${PRAISE_MAX_CHARS} characters at most. It must name him and be original: no insults, no mash, no copies.`,
      },
    },
    {
      key: "royal_favor",
      group: "devotion",
      flow: "earn",
      amount: plus(ROYAL_FAVOR),
      help: {
        title: "Royal favor",
        does: "Salaxe reads the court's praises and crowns the ones he likes.",
        cost: FREE,
        reward: `${pts(ROYAL_FAVOR)} per crowned praise`,
        limits: `He has ${CROWNS_PER_DAY} crowns a day for the whole court. His verdict is final.`,
      },
    },
    {
      key: "mvp",
      group: "prophecy",
      flow: "earn",
      amount: plus(MVP_BONUS),
      help: {
        title: "MVP of the Tribunal",
        does: "After every game the court votes an MVP and an Inter. The MVP gets paid.",
        cost: "Free. Voting is free too",
        reward: `${pts(MVP_BONUS)} to each crowned MVP`,
        limits: `The leader needs ${MIN_VOTES_FOR_VERDICT}+ votes. A canceled game voids the vote.`,
      },
    },
    {
      key: "title_perks",
      group: "titles",
      flow: "earn",
      amount: `up to ${plus(PERK_CAP)}`,
      help: {
        title: "Title perks",
        does: "Your equipped title pays out on its own after every game you take part in.",
        cost: "Free once you own the title",
        reward: `Up to ${pts(PERK_CAP)} a game, depending on the title`,
        limits: `One banner at a time. A few gamble titles can cost up to ${pts(PERK_PENALTY_CAP)} a game. Counts if you played, bet ${MIN_STAKE}+, cast a decree or cashed a bounty.`,
      },
    },
    {
      key: "act_honors",
      group: "treasury",
      flow: "earn",
      amount: "Per award",
      help: {
        title: "Act honors",
        does: "When an act ends, the Hall of Fame names its richest, its best player, its biggest bettor and more. Each award carries bonus points into the next act.",
        cost: FREE,
        reward: "The award's carry-over bonus, shown in the Archives",
        limits: "Claimed once from the reward banner when the new act opens.",
      },
    },
    {
      key: "wagers",
      group: "wagers",
      flow: "risk",
      amount: "x pool",
      help: {
        title: "Royal Wagers",
        does: "Bet on Blue or Red before the game. The winning side splits the whole pool in proportion to each stake.",
        cost: `Any stake you can cover, up to ${pts(BET_RULES.maxStake)}`,
        reward: `Your share of the pool. +${BET_RULES.earlyBonusPct}% on profit in the first ${BET_RULES.earlySeconds}s, +${BET_RULES.allInBonusPct}% on a winning all-in (${BET_RULES.allInMin}+)`,
        limits: `Open ${Math.round(BET_RULES.windowSeconds / 60)} minutes before the game. Refunded if nobody bets the other side or the game is canceled. ${FLOOR_RULE}`,
      },
    },
    {
      key: "guardian_angel",
      group: "insurance",
      flow: "risk",
      amount: `${BET_RULES.premiumPct}-${BET_RULES.premiumMaxPct}%`,
      help: {
        title: "Guardian Angel",
        does: "Insure a wager: if your side loses, part of the stake comes back.",
        cost: `${BET_RULES.premiumPct}% to ${BET_RULES.premiumMaxPct}% of the stake, pricier on long shots`,
        reward: `${BET_RULES.coveragePct}% of the stake back if your side loses`,
        limits: `Stakes of ${BET_RULES.insuranceMin}+ only, never on an all-in. The premium is refunded with the wager.`,
      },
    },
    {
      key: "kings_wager",
      group: "decrees",
      flow: "risk",
      amount: `${WAGER_BASE_MULTIPLIER}-${WAGER_MAX_MULTIPLIER}x`,
      help: {
        title: "The King's Wager",
        does: "A decree that backs one side. If it wins, the treasury pays a multiple of its price.",
        cost: pts(KINGS_WAGER_COST),
        reward: `${WAGER_BASE_MULTIPLIER}x the price, +${WAGER_DEFIANCE_STEP}x per hostile decree others land on your side, up to ${WAGER_MAX_MULTIPLIER}x`,
        limits: "Players can only back their own team, and all your wagers in a game ride on one side.",
      },
    },
    {
      key: "prophecies",
      group: "prophecy",
      flow: "risk",
      amount: `${STAKE_MIN}-${STAKE_MAX}`,
      help: {
        title: "Prophecies",
        does: "Before the game, name who the Tribunal will vote MVP or Inter. Everyone who called it splits that market's pot.",
        cost: ptsRange(STAKE_MIN, STAKE_MAX),
        reward: "Your share of the pot, by stake",
        limits: "One prophecy per game. No verdict, or nobody called it: every stake comes back.",
      },
    },
    {
      key: "duels",
      group: "duels",
      flow: "risk",
      amount: `${DUEL_RULES.minStake}-${DUEL_RULES.maxStake}`,
      help: {
        title: "Trials by Combat",
        does: "Challenge a rival on the game result. Both put up the same stake and the winning banner takes both.",
        cost: `${ptsRange(DUEL_RULES.minStake, DUEL_RULES.maxStake)}, matched by your rival`,
        reward: `Both stakes, minus the Crown's ${DUEL_RULES.taxPct}% tithe on the winnings`,
        limits: `${DUEL_RULES.maxPending} unanswered gauntlets at most. Declined, unanswered or canceled: every point goes home.`,
      },
    },
    {
      key: "bounties",
      group: "bounties",
      flow: "risk",
      amount: `${BOUNTY_RULES.minPledge}+`,
      help: {
        title: "Royal Warrants",
        does: "Put a price on a player's head. The next team that beats them splits the price.",
        cost: `${BOUNTY_RULES.minPledge}+ points, up to ${pts(BOUNTY_RULES.maxBackerTotal)} per backer`,
        reward: `Hunters split the price. Every escape adds ${BOUNTY_RULES.escapePct}% from the Crown (${BOUNTY_RULES.escapeMin} to ${BOUNTY_RULES.escapeMax})`,
        limits: `Unclaimed ${BOUNTY_RULES.lifetimeDays} days after the last pledge: every backer is refunded.`,
      },
    },
    {
      key: "decrees",
      group: "decrees",
      flow: "spend",
      amount: span(DECREE_COSTS),
      help: {
        title: "Royal Decrees",
        does: `Meddle with the draft before the game: reroll, swap, exile or shield. Sabotage (${SABOTAGE_NAMES.join(", ")}) hits other players.`,
        cost: `${ptsRange(DECREE_COSTS.min, DECREE_COSTS.max)} per decree`,
        reward: "Nothing, except chaos. Refunded if it never takes effect",
        limits: `Most decrees once per game, during the decree window. ${FLOOR_RULE}`,
      },
    },
    {
      key: "pillory",
      group: "shame",
      flow: "spend",
      amount: `${PILLORY_RULES.cost}`,
      help: {
        title: "The Pillory",
        does: `Put a player on the wall of shame for ${PILLORY_RULES.hours} hours with their worst real stat.`,
        cost: pts(PILLORY_RULES.cost),
        reward: "Nothing but satisfaction. Eggs are free",
        limits: `One pillory every ${PILLORY_RULES.cooldownHours} hours. The Tribunal's Inter goes up for free.`,
      },
    },
    {
      key: "titles",
      group: "titles",
      flow: "spend",
      amount: titles ? span(titles) : "Shop price",
      help: {
        title: "Titles",
        does: "Buy a title for your banner. Equipped, its perk pays after every game you take part in.",
        cost: titles ? `${ptsRange(titles.min, titles.max)} in the Hall of Titles` : "The shop price in the Hall of Titles",
        reward: `Its perk, up to ${pts(PERK_CAP)} a game`,
        limits: "One banner at a time. Titles are sealed while a game is live.",
      },
    },
    {
      key: "brands",
      group: "titles",
      flow: "spend",
      amount: brands ? span(brands) : "Shop price",
      help: {
        title: "Brands",
        does: `Buy a mockery title for someone else. It burns for ${CURSE_GAMES} games and pays you tribute.`,
        cost: brands ? ptsRange(brands.min, brands.max) : "The shop price in the Hall of Titles",
        reward: "Tribute from the branded player while it burns",
        limits: `${MAX_ACTIVE_CURSES} brands per player at most. They can burn it off early for ${DIGNITY_MULTIPLIER}x its price.`,
      },
    },
  ]
}

const REASON_ENTRY: Partial<Record<string, EconomyKey>> = {
  initial_grant: "starting_purse",
  daily_bonus: "daily_stipend",
  act_carryover: "act_honors",
  game_win: "victory",
  game_participation: "game_played",
  sing_his_praises: "praise",
  royal_favor: "royal_favor",
  mvp_bonus: "mvp",
  title_perk: "title_perks",
  title_bought: "titles",
  title_curse: "brands",
  title_tribute: "brands",
  title_dignity: "brands",
  chaos_spent: "decrees",
  sabotage_spent: "decrees",
  chaos_won: "kings_wager",
  chaos_refunded: "decrees",
  shame_spent: "pillory",
}

// The feature a ledger line falls back to when its reason has no entry of its own.
const GROUP_ENTRY: Partial<Record<ReasonGroup, EconomyKey>> = {
  games: "victory",
  wagers: "wagers",
  insurance: "guardian_angel",
  decrees: "decrees",
  devotion: "praise",
  titles: "titles",
  prophecy: "prophecies",
  bounties: "bounties",
  duels: "duels",
  shame: "pillory",
}

const GROUP_WHAT: Record<ReasonGroup, string> = {
  games: "Wages for playing: every declared game pays its players, and the winners more.",
  wagers: "Bets on Blue or Red: stakes go into the pool and the winning side splits it.",
  insurance: "Guardian Angel cover on your wagers: premiums out, payouts back when it saved you.",
  decrees: "Royal Decrees cast before games, and what the King's Wager paid back.",
  devotion: "Written praise for Salaxe, and the favor he grants the best verses.",
  titles: "Titles bought, perks paid after games, brands and the tribute they move.",
  prophecy: "MVP and Inter prophecies, and the bonus for the Tribunal's MVP.",
  bounties: "Warrants posted on players, and the shares their hunters collected.",
  duels: "One-on-one stakes on the game result, and the Crown's tithe.",
  shame: "Players you put in the pillory.",
  treasury: "The starting purse, the daily stipend and Hall of Fame honors.",
  other: "Movements the royal scribes have not filed under a feature yet.",
}

const DEFAULT_LIST = economyEntries()
const DEFAULT_ENTRIES = new Map(DEFAULT_LIST.map((e) => [e.key, e]))

export function economyEntry(key: EconomyKey): EconomyEntry {
  return DEFAULT_ENTRIES.get(key) as EconomyEntry
}

// The bubble of one ledger line: what the line is, with the costs and rules of the feature behind it.
export function reasonHelp(code: string | null | undefined, amount?: number): HelpEntry {
  const meta = reasonMeta(code)
  const key = REASON_ENTRY[meta.code] ?? GROUP_ENTRY[meta.group]
  const feature = key ? economyEntry(key).help : null
  return {
    title: reasonLabel(code, amount),
    does: meta.what,
    cost: feature?.cost ?? FREE,
    reward: feature?.reward,
    limits: feature?.limits ? `${feature.title}: ${feature.limits}` : undefined,
  }
}

// What a whole income or spending group stands for, with every source and sink it gathers.
export function groupHelp(group: ReasonGroup, label: string): HelpEntry {
  const members = DEFAULT_LIST.filter((e) => e.group === group)
  const mainKey = GROUP_ENTRY[group]
  const main = mainKey ? economyEntry(mainKey).help : null
  return {
    title: label,
    does: GROUP_WHAT[group],
    cost: main?.cost ?? FREE,
    reward: main?.reward,
    limits: members.length > 1 ? members.map((e) => `${e.help.title} (${e.amount})`).join(", ") : main?.limits,
  }
}

// The bubble on the purse in the header.
export const PURSE_HELP: HelpEntry = {
  title: "Your purse",
  does: "Points are the court's currency. You earn them by showing up, playing and praising Salaxe, and risk or spend them on wagers, decrees, duels, titles and grudges.",
  cost: `Free to hold. You can spend into debt, down to ${DEBT_FLOOR} and never lower`,
  reward: `${plus(PRAISE_REWARD)} for a daily praise, ${plus(GAME_WIN_POINTS)} a win, ${plus(GAME_PARTICIPATION_POINTS)} a game, ${plus(DAILY_STIPEND)} daily stipend, ${plus(MVP_BONUS)} as MVP`,
  limits: "The leaderboard ranks your balance. Every act resets every purse.",
}
