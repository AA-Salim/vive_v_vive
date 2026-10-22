import {
  AwardIcon,
  BadgeCheckIcon,
  BanknoteIcon,
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
  group: ReasonGroup
  kind: ReasonKind
  icon: LucideIcon
}

type Definition = Omit<ReasonMeta, "code">

const def = (label: string, detail: string, group: ReasonGroup, kind: ReasonKind, icon: LucideIcon): Definition => ({
  label,
  detail,
  group,
  kind,
  icon,
})

export const REASONS: Readonly<Record<string, Definition>> = {
  initial_grant: def("Starting purse", "The court's allowance for a new act.", "treasury", "earn", GiftIcon),
  daily_bonus: def("Daily stipend", "Showing up is half the battle.", "treasury", "earn", CalendarCheckIcon),
  act_carryover: def("Act honors", "Carried over from the previous act's Hall of Fame.", "treasury", "earn", AwardIcon),

  game_win: def("Victory", "A real one, not a delayed one.", "games", "earn", TrophyIcon),
  game_participation: def("Game played", "Wages for a shift on the Rift.", "games", "earn", SwordsIcon),

  bet_placed: def("Wager placed", "Into the pool it goes.", "wagers", "spend", CoinsIcon),
  bet_won: def("Wager won", "The notebook pays out.", "wagers", "earn", HandCoinsIcon),
  bet_refunded: def("Wager refunded", "The game never counted. The coin comes home.", "wagers", "refund", RotateCcwIcon),
  bet_early_bonus: def("Early-bird boost", "Called it before the crowd did.", "wagers", "earn", TimerIcon),
  bet_all_in_bonus: def("All-in bonus", "Everything on one side, and the side delivered.", "wagers", "earn", FlameIcon),

  insurance_bought: def("Guardian Angel premium", "Paid to sleep at night.", "insurance", "spend", ShieldIcon),
  insurance_payout: def("Guardian Angel payout", "The angel caught you on the way down.", "insurance", "earn", ShieldCheckIcon),
  insurance_refunded: def("Premium refunded", "The cover was never needed, or the game never counted.", "insurance", "refund", RotateCcwIcon),
  insurance_bug_payout: def("Guardian Angel correction", "An old insurance bug, repaid in full.", "insurance", "earn", WrenchIcon),
  insurance_bug_refund: def("Premium correction", "An overcharged premium, handed back.", "insurance", "refund", WrenchIcon),

  chaos_spent: def("Royal decree", "Chaos has a price.", "decrees", "spend", ScrollTextIcon),
  chaos_won: def("Decree paid off", "The meddling worked. The court pays.", "decrees", "earn", ZapIcon),
  chaos_refunded: def("Decree refunded", "The decree never took effect.", "decrees", "refund", RotateCcwIcon),
  sabotage_spent: def("Sabotage", "Treason, at cost price.", "decrees", "spend", SkullIcon),

  kiss_the_hand: def("Kissed the hand", "Tribute to Le Bon Salaxe, back when he had a throne.", "devotion", "devotion", CrownIcon),
  sing_his_praises: def("Sang his praises", "A verse for the fallen king. He wrote it down.", "devotion", "devotion", MicIcon),

  title_bought: def("Title purchased", "A new name for the court to mock.", "titles", "spend", BadgeCheckIcon),
  title_perk: def("Title perk", "Your banner went to work.", "titles", "signed", SparklesIcon),
  title_tribute: def("Title tribute", "Paid between the brander and the branded.", "titles", "signed", HeartHandshakeIcon),
  title_dignity: def("Dignity restored", "Bought your way out of a brand.", "titles", "spend", FeatherIcon),

  prophecy_bonus: def("Prophecy fulfilled", "The old oracle paid out.", "prophecy", "earn", EyeIcon),
  prophecy_stake: def("Prophecy sealed", "A stake on the Tribunal's verdict.", "prophecy", "spend", EyeIcon),
  prophecy_won: def("Prophecy came true", "You saw it coming.", "prophecy", "earn", StarIcon),
  prophecy_refunded: def("Prophecy refunded", "The Tribunal could not decide.", "prophecy", "refund", RotateCcwIcon),
  mvp_bonus: def("MVP bonus", "Crowned by the Tribunal.", "prophecy", "earn", StarIcon),

  bounty_placed: def("Bounty posted", "A price on someone's head.", "bounties", "spend", CrosshairIcon),
  bounty_claimed: def("Bounty collected", "The target fell. The poster gets paid.", "bounties", "earn", CrosshairIcon),
  bounty_expired_refund: def("Bounty expired", "Nobody collected. The gold comes back.", "bounties", "refund", RotateCcwIcon),

  shame_spent: def("Public shaming", "Worth every point.", "shame", "spend", MegaphoneIcon),
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
        group: family.group,
        kind: family.group === "devotion" && kindFromSuffix(suffix) === "signed" ? "devotion" : kindFromSuffix(suffix),
        icon: family.icon,
      }
    } else {
      meta = {
        code: key,
        label: humanize(key),
        detail: "A movement the royal scribes have not named yet.",
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
