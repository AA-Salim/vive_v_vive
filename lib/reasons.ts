import {
  AwardIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  BrainIcon,
  CalendarCheckIcon,
  CoinsIcon,
  CrosshairIcon,
  CrownIcon,
  EyeIcon,
  FeatherIcon,
  FlameIcon,
  GavelIcon,
  GiftIcon,
  HandCoinsIcon,
  HeartHandshakeIcon,
  type LucideIcon,
  MegaphoneIcon,
  MicIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SkullIcon,
  SparklesIcon,
  StarIcon,
  SwordsIcon,
  TimerIcon,
  TrophyIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react"
import { BET_RULES } from "@/lib/betting/rules"
import { BOUNTY_RULES, PILLORY_RULES } from "@/lib/bounties/rules"
import { WAGER_BASE_MULTIPLIER, WAGER_DEFIANCE_STEP, WAGER_MAX_DEFIANCE } from "@/lib/chaos/catalog"
import { DUEL_RULES } from "@/lib/duels/rules"
import { DAILY_STIPEND } from "@/lib/lore/daily"
import { CROWNS_PER_DAY, PRAISE_PER_DAY, PRAISE_REWARDS, RIDDLE_FIRST_TRY_BONUS, ROYAL_FAVOR } from "@/lib/praise/rules"
import { MIN_VOTES_FOR_VERDICT, MVP_BONUS, STAKE_MAX, STAKE_MIN } from "@/lib/prophecy/constants"
import { GAME_PARTICIPATION_POINTS, GAME_WIN_POINTS } from "@/lib/session/constants"
import { CURSE_GAMES, DIGNITY_MULTIPLIER, PERK_PENALTY_CAP } from "@/lib/titles/rules"

export type ReasonGroup =
  | "games"
  | "wagers"
  | "insurance"
  | "decrees"
  | "devotion"
  | "titles"
  | "prophecy"
  | "bounties"
  | "duels"
  | "shame"
  | "treasury"
  | "other"

// earn/spend/refund describe the usual direction; "signed" reasons can go either way (perks and curses).
export type ReasonKind = "earn" | "spend" | "refund" | "devotion" | "signed"

export type ReasonTone = "gain" | "loss" | "refund" | "royal" | "neutral"

export interface ReasonMeta {
  code: string
  label: string
  detail: string
  // Plain "what is this line" for the ledger bubble, built from the rule constants.
  what: string
  group: ReasonGroup
  kind: ReasonKind
  icon: LucideIcon
}

type Definition = Omit<ReasonMeta, "code">

const def = (
  label: string,
  detail: string,
  what: string,
  group: ReasonGroup,
  kind: ReasonKind,
  icon: LucideIcon
): Definition => ({ label, detail, what, group, kind, icon })

const WAGER_MAX_MULTIPLIER = WAGER_BASE_MULTIPLIER + WAGER_DEFIANCE_STEP * WAGER_MAX_DEFIANCE

export const REASONS: Readonly<Record<string, Definition>> = {
  initial_grant: def(
    "Starting purse",
    "The court's allowance for a new act.",
    "The purse every noble opens an act with, or gets on their first visit during one.",
    "treasury",
    "earn",
    GiftIcon
  ),
  daily_bonus: def(
    "Daily stipend",
    "Showing up is half the battle.",
    `+${DAILY_STIPEND} the first time you open the app each day.`,
    "treasury",
    "earn",
    CalendarCheckIcon
  ),
  act_carryover: def(
    "Act honors",
    "Carried over from the previous act's Hall of Fame.",
    "Bonus points from a Hall of Fame award, carried into the next act.",
    "treasury",
    "earn",
    AwardIcon
  ),

  game_win: def(
    "Victory",
    "A real one, not a delayed one.",
    `+${GAME_WIN_POINTS} to every player on the winning side.`,
    "games",
    "earn",
    TrophyIcon
  ),
  game_participation: def(
    "Game played",
    "Wages for a shift on the Rift.",
    `+${GAME_PARTICIPATION_POINTS} to every player of a game, win or lose.`,
    "games",
    "earn",
    SwordsIcon
  ),

  bet_placed: def("Wager placed", "Into the pool it goes.", "Your stake leaving your purse for the betting pool.", "wagers", "spend", CoinsIcon),
  bet_won: def(
    "Wager won",
    "The notebook pays out.",
    "Your share of the whole pool: the winning side splits it in proportion to each stake.",
    "wagers",
    "earn",
    HandCoinsIcon
  ),
  bet_refunded: def(
    "Wager refunded",
    "The game never counted. The coin comes home.",
    "Your stake came back: the game was canceled or nobody bet on the other side.",
    "wagers",
    "refund",
    RotateCcwIcon
  ),
  bet_early_bonus: def(
    "Early-bird boost",
    "Called it before the crowd did.",
    `+${BET_RULES.earlyBonusPct}% on the profit of what you staked in the first ${BET_RULES.earlySeconds} seconds.`,
    "wagers",
    "earn",
    TimerIcon
  ),
  bet_all_in_bonus: def(
    "All-in bonus",
    "Everything on one side, and the side delivered.",
    `+${BET_RULES.allInBonusPct}% on profit for a winning all-in of ${BET_RULES.allInMin}+ points.`,
    "wagers",
    "earn",
    FlameIcon
  ),

  insurance_bought: def(
    "Guardian Angel premium",
    "Paid to sleep at night.",
    `The price of insuring a wager: ${BET_RULES.premiumPct}% to ${BET_RULES.premiumMaxPct}% of the stake, higher on long shots.`,
    "insurance",
    "spend",
    ShieldIcon
  ),
  insurance_payout: def(
    "Guardian Angel payout",
    "The angel caught you on the way down.",
    `${BET_RULES.coveragePct}% of an insured stake, handed back when its side lost.`,
    "insurance",
    "earn",
    ShieldCheckIcon
  ),
  insurance_refunded: def(
    "Premium refunded",
    "The cover was never needed, or the game never counted.",
    "Your premium came back: the wager was refunded, so the cover was void.",
    "insurance",
    "refund",
    RotateCcwIcon
  ),
  insurance_bug_payout: def(
    "Guardian Angel correction",
    "An old insurance bug, repaid in full.",
    "A one-off repayment for an insurance payout an old bug forgot.",
    "insurance",
    "earn",
    WrenchIcon
  ),
  insurance_bug_refund: def(
    "Premium correction",
    "An overcharged premium, handed back.",
    "A one-off refund for a premium an old bug overcharged.",
    "insurance",
    "refund",
    WrenchIcon
  ),

  chaos_spent: def(
    "Royal decree",
    "Chaos has a price.",
    "The price of a Royal Decree cast before the game: a wager, a favor or a cataclysm.",
    "decrees",
    "spend",
    ScrollTextIcon
  ),
  chaos_won: def(
    "Decree paid off",
    "The meddling worked. The court pays.",
    `The King's Wager paid ${WAGER_BASE_MULTIPLIER}x its price (up to ${WAGER_MAX_MULTIPLIER}x when rivals sabotaged your side).`,
    "decrees",
    "earn",
    ZapIcon
  ),
  chaos_refunded: def(
    "Decree refunded",
    "The decree never took effect.",
    "The decree's price came back: it never took effect or the game was canceled.",
    "decrees",
    "refund",
    RotateCcwIcon
  ),
  sabotage_spent: def(
    "Sabotage",
    "Treason, at cost price.",
    "The price of a sabotage decree aimed at another player's lane or champion.",
    "decrees",
    "spend",
    SkullIcon
  ),

  kiss_the_hand: def(
    "Kissed the hand",
    "Tribute to Le Bon Salaxe, back when he had a throne.",
    "The one-click tribute of Act I. Retired: Salaxe now only pays for written praise.",
    "devotion",
    "devotion",
    CrownIcon
  ),
  sing_his_praises: def(
    "Sang his praises",
    "A verse for the fallen king. He wrote it down.",
    `+${PRAISE_REWARDS.join(", +")} for the day's written praises of Salaxe, up to ${PRAISE_PER_DAY} a day.`,
    "devotion",
    "devotion",
    MicIcon
  ),
  royal_favor: def(
    "Royal favor",
    "He read it twice. Then he crowned it.",
    `+${ROYAL_FAVOR} when Salaxe crowns your praise. He hands out ${CROWNS_PER_DAY} crowns a day, for the whole court.`,
    "devotion",
    "earn",
    CrownIcon
  ),
  riddle_bonus: def(
    "Sharp Mind",
    "Solved the King's Riddle on the first try.",
    `+${RIDDLE_FIRST_TRY_BONUS} on top of the praise when you solve the King's Riddle on your first try.`,
    "devotion",
    "earn",
    BrainIcon
  ),

  title_bought: def(
    "Title purchased",
    "A new name for the court to mock.",
    "The shop price of a title, for your own banner or as a brand on someone else.",
    "titles",
    "spend",
    BadgeCheckIcon
  ),
  title_perk: def(
    "Title perk",
    "Your banner went to work.",
    `What one of your equipped titles paid after a game: capped per title and for all of them together, never worse than -${PERK_PENALTY_CAP}.`,
    "titles",
    "signed",
    SparklesIcon
  ),
  title_curse: def(
    "Title curse",
    "The brand bled a little more.",
    `A brand someone put on you, taking its cut after a game. It burns for ${CURSE_GAMES} games.`,
    "titles",
    "signed",
    SkullIcon
  ),
  title_tribute: def(
    "Title tribute",
    "Paid between the brander and the branded.",
    "Points a brand moves from the branded player to whoever bought it.",
    "titles",
    "signed",
    HeartHandshakeIcon
  ),
  title_dignity: def(
    "Dignity restored",
    "Bought your way out of a brand.",
    `Burning a brand off early: ${DIGNITY_MULTIPLIER}x its shop price, kept by the Crown.`,
    "titles",
    "spend",
    FeatherIcon
  ),
  title_stipend_bonus: def(
    "Stipend bonus",
    "A title doubled your daily stipend.",
    "The extra half of a doubled daily stipend, paid by Still Kneeling.",
    "titles",
    "earn",
    CalendarCheckIcon
  ),
  title_stipend_redirected: def(
    "Stipend to Salaxe",
    "A brand sent your daily stipend to Salaxe.",
    "Your daily stipend was claimed, and Salaxe's Emotional Support paid it to the King instead of you.",
    "titles",
    "signed",
    HeartHandshakeIcon
  ),
  title_stipend_tribute: def(
    "Stipend tribute",
    "Someone's daily stipend, redirected to the King.",
    "A daily stipend redirected to you by the Salaxe's Emotional Support brand.",
    "titles",
    "earn",
    HeartHandshakeIcon
  ),
  title_duel_refund: def(
    "Duel consolation",
    "A title returned part of a lost duel.",
    "Part of a lost duel's stake, returned by Delayed Victory Specialist.",
    "duels",
    "refund",
    SwordsIcon
  ),

  prophecy_bonus: def("Prophecy fulfilled", "The old oracle paid out.", "A payout from the first prophecy system, before the Tribunal.", "prophecy", "earn", EyeIcon),
  prophecy_stake: def(
    "Prophecy sealed",
    "A stake on the Tribunal's verdict.",
    `Your stake (${STAKE_MIN} to ${STAKE_MAX}) on who the Tribunal will vote MVP or Inter.`,
    "prophecy",
    "spend",
    EyeIcon
  ),
  prophecy_won: def(
    "Prophecy came true",
    "You saw it coming.",
    "Your share of the prophecy pot: everyone who named the voted player splits it.",
    "prophecy",
    "earn",
    StarIcon
  ),
  prophecy_refunded: def(
    "Prophecy refunded",
    "The Tribunal could not decide.",
    `Your stake came back: no verdict (the leader needs ${MIN_VOTES_FOR_VERDICT} votes), nobody called it, or the game was canceled.`,
    "prophecy",
    "refund",
    RotateCcwIcon
  ),
  mvp_bonus: def("MVP bonus", "Crowned by the Tribunal.", `+${MVP_BONUS} when the post-game vote names you MVP.`, "prophecy", "earn", StarIcon),

  bounty_placed: def(
    "Bounty posted",
    "A price on someone's head.",
    `Your pledge on a warrant: ${BOUNTY_RULES.minPledge}+ points, up to ${BOUNTY_RULES.maxBackerTotal} per backer.`,
    "bounties",
    "spend",
    CrosshairIcon
  ),
  bounty_claimed: def(
    "Bounty collected",
    "The target fell. The poster gets paid.",
    "Your cut of a warrant: the wanted player lost to your team, and the price was split.",
    "bounties",
    "earn",
    CrosshairIcon
  ),
  bounty_expired_refund: def(
    "Bounty expired",
    "Nobody collected. The gold comes back.",
    `Your pledge came back: nobody collected it within ${BOUNTY_RULES.lifetimeDays} days.`,
    "bounties",
    "refund",
    RotateCcwIcon
  ),

  duel_stake: def(
    "Duel stake",
    "The gauntlet hit the floor.",
    `Your stake in a trial by combat, ${DUEL_RULES.minStake} to ${DUEL_RULES.maxStake}, held until the game ends.`,
    "duels",
    "spend",
    SwordsIcon
  ),
  duel_won: def("Duel won", "The steel was kind.", "Both stakes of a duel your banner won.", "duels", "earn", SwordsIcon),
  duel_tax: def(
    "Royal tithe",
    "The exiled King's war chest grows.",
    `The Crown's ${DUEL_RULES.taxPct}% cut of the winnings of a duel you won.`,
    "duels",
    "spend",
    SwordsIcon
  ),
  duel_refunded: def(
    "Duel refunded",
    "Nobody bled. Everyone went home.",
    "Your stake came back: declined, withdrawn, unanswered or a canceled game.",
    "duels",
    "refund",
    RotateCcwIcon
  ),

  shame_spent: def(
    "Public shaming",
    "Worth every point.",
    `${PILLORY_RULES.cost} points to put a player in the pillory for ${PILLORY_RULES.hours} hours.`,
    "shame",
    "spend",
    MegaphoneIcon
  ),
}

const PREFIX_GROUPS: ReadonlyArray<{ prefix: string; noun: string; group: ReasonGroup; icon: LucideIcon }> = [
  { prefix: "duel_", noun: "Duel", group: "duels", icon: SwordsIcon },
  { prefix: "bounty_", noun: "Bounty", group: "bounties", icon: CrosshairIcon },
  { prefix: "shame_", noun: "Shame", group: "shame", icon: MegaphoneIcon },
  { prefix: "praise_", noun: "Praise", group: "devotion", icon: MicIcon },
  { prefix: "chaos_", noun: "Decree", group: "decrees", icon: ScrollTextIcon },
  { prefix: "title_", noun: "Title", group: "titles", icon: BadgeCheckIcon },
  { prefix: "prophecy_", noun: "Prophecy", group: "prophecy", icon: EyeIcon },
  { prefix: "insurance_", noun: "Guardian Angel", group: "insurance", icon: ShieldIcon },
  { prefix: "bet_", noun: "Wager", group: "wagers", icon: CoinsIcon },
  { prefix: "sabotage_", noun: "Sabotage", group: "decrees", icon: SkullIcon },
  { prefix: "act_", noun: "Act", group: "treasury", icon: GavelIcon },
]

const SUFFIX_KIND: ReadonlyArray<[RegExp, ReasonKind]> = [
  [/(refund|refunded|returned|rollback)$/, "refund"],
  [/(spent|placed|stake|staked|paid|fee|cost|bought|lost|penalty|tax)$/, "spend"],
  [/(won|win|bonus|payout|claimed|reward|prize|earned|collected|grant)$/, "earn"],
]

export const REASON_GROUPS: Readonly<Record<ReasonGroup, { label: string; icon: LucideIcon }>> = {
  games: { label: "Games", icon: SwordsIcon },
  wagers: { label: "Wagers", icon: CoinsIcon },
  insurance: { label: "Guardian Angel", icon: ShieldIcon },
  decrees: { label: "Royal decrees", icon: ScrollTextIcon },
  devotion: { label: "Devotion", icon: CrownIcon },
  titles: { label: "Titles", icon: BadgeCheckIcon },
  prophecy: { label: "Prophecies", icon: EyeIcon },
  bounties: { label: "Bounties", icon: CrosshairIcon },
  duels: { label: "Duels", icon: SwordsIcon },
  shame: { label: "Shame", icon: MegaphoneIcon },
  treasury: { label: "Treasury", icon: BanknoteIcon },
  other: { label: "Other", icon: CoinsIcon },
}

export const DEVOTION_REASONS = ["kiss_the_hand", "sing_his_praises"] as const

function humanize(words: string): string {
  const text = words.replace(/_+/g, " ").trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Treasury movement"
}

function kindFromSuffix(suffix: string): ReasonKind {
  return SUFFIX_KIND.find(([pattern]) => pattern.test(suffix))?.[1] ?? "signed"
}

const cache = new Map<string, ReasonMeta>()

export function reasonMeta(code: string | null | undefined): ReasonMeta {
  const key = (code ?? "").trim().toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit

  let meta: ReasonMeta
  const known = REASONS[key]
  if (known) {
    meta = { code: key, ...known }
  } else {
    const family = PREFIX_GROUPS.find((p) => key.startsWith(p.prefix))
    if (family) {
      const suffix = key.slice(family.prefix.length)
      meta = {
        code: key,
        label: `${family.noun} ${humanize(suffix).toLowerCase()}`,
        detail: `${REASON_GROUPS[family.group].label}: ${humanize(suffix).toLowerCase()}.`,
        what: `A ${REASON_GROUPS[family.group].label.toLowerCase()} movement: ${humanize(suffix).toLowerCase()}.`,
        group: family.group,
        kind: family.group === "devotion" && kindFromSuffix(suffix) === "signed" ? "devotion" : kindFromSuffix(suffix),
        icon: family.icon,
      }
    } else {
      meta = {
        code: key,
        label: humanize(key),
        detail: "A movement the royal scribes have not named yet.",
        what: "A treasury movement the scribes have not filed under a feature yet.",
        group: "other",
        kind: kindFromSuffix(key),
        icon: CoinsIcon,
      }
    }
  }
  cache.set(key, meta)
  return meta
}

export function reasonLabel(code: string | null | undefined, amount?: number): string {
  const meta = reasonMeta(code)
  if (meta.kind !== "signed" || amount === undefined || amount === 0) return meta.label
  if (meta.code === "title_perk") return amount > 0 ? "Title perk" : "Title curse"
  if (meta.code === "title_tribute") return amount > 0 ? "Tribute received" : "Tribute paid"
  return meta.label
}

export function reasonTone(code: string | null | undefined, amount: number): ReasonTone {
  const meta = reasonMeta(code)
  if (meta.kind === "refund") return "refund"
  if (meta.kind === "devotion") return "royal"
  if (amount > 0) return "gain"
  if (amount < 0) return "loss"
  return "neutral"
}

export function isDevotion(code: string | null | undefined): boolean {
  return (DEVOTION_REASONS as readonly string[]).includes((code ?? "").toLowerCase())
}

// Tailwind classes per tone, shared by ledgers and chips (team colors stay reserved for sides).
export const REASON_TONE_CLASSES: Readonly<Record<ReasonTone, { text: string; chip: string }>> = {
  gain: { text: "text-emerald-300", chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" },
  loss: { text: "text-rose-300", chip: "bg-rose-400/10 text-rose-300 ring-rose-400/25" },
  refund: { text: "text-[var(--color-gold-light)]/80", chip: "bg-muted text-[var(--color-gold-light)]/80 ring-border" },
  royal: { text: "text-[var(--color-gold)]", chip: "bg-[var(--color-gold)]/12 text-[var(--color-gold)] ring-[var(--color-gold)]/30" },
  neutral: { text: "text-muted-foreground", chip: "bg-muted text-muted-foreground ring-border" },
}
