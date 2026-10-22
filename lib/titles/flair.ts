import { isCurseCategory } from "@/lib/titles/catalog"
import { actAwardKind } from "@/lib/titles/perks"
import type { CurseBadge, EquippedTitle, TitleRarity } from "@/lib/titles/types"

export type FlairTone = "rebellion" | "loyalty" | "absurd" | "award" | "jester"

export interface Flair {
  tone: FlairTone
  rarity: TitleRarity
  strong: boolean
}

export type MarkKind = "bells" | "boot" | "carpet" | "heart" | "snail" | "skull"

const TONES: Record<string, FlairTone> = {
  rebellion: "rebellion",
  loyalty: "loyalty",
  absurd: "absurd",
  award: "award",
  mockery: "jester",
}

const MARKS: Record<string, MarkKind> = {
  "Court Jester": "bells",
  "Boot Licker": "boot",
  "Royal Carpet": "carpet",
  "Salaxe's Emotional Support": "heart",
  "The Crawling One": "snail",
}

// Titles that read as a sentence rather than a rank: they become a quoted nickname, not "the ...".
const NICKNAMES = new Set([
  "Still Kneeling",
  "Summoned",
  "Committed to the Rift",
  "Can't Stop Won't Stop",
  "Half-Century Club",
  "Grass Is a Myth",
  "This Game Is My Personality",
  "First Taste of Victory",
  "Winner By Habit",
  "Unkillable Legacy",
  "At Least You Tried",
  "Random Champs, Calculated Wins",
  "Can't Help Myself",
  "Lucky Guess",
  "Pocket Change",
  "Stacking Paper",
  "Down Horrendous For Salaxe",
  "First Blood (Emotional)",
  "Chaos Incarnate",
  "Almost Relevant",
])

const ACT_AWARD = /^Act\s+([IVXLC]+|\d+):?\s+(.+)$/i

// "Kingslayer" -> "the Kingslayer", "Act I Grand Champion" -> "the Grand Champion of Act I",
// "Grass Is a Myth" -> a quoted nickname, so "laefo the Kingslayer bet 100" always reads as a sentence.
export function epithetFor(title: string): string {
  const name = title.trim()
  const act = ACT_AWARD.exec(name)
  if (act && actAwardKind(name)) return `the ${act[2]} of Act ${act[1].toUpperCase()}`
  if (/^the\s/i.test(name)) return `the ${name.slice(4)}`
  if (NICKNAMES.has(name) || /^\S+'s\s/.test(name) || /^El\s/.test(name) || name.includes(":")) return `“${name}”`
  return `the ${name}`
}

export function bannerOf(entry: EquippedTitle | null | undefined): EquippedTitle | null {
  return entry && entry.kind !== "curse" ? entry : null
}

export function cursesOf(entry: EquippedTitle | null | undefined): CurseBadge[] {
  return entry?.curses ?? []
}

export function flairOf(entry: EquippedTitle | null | undefined): Flair | null {
  if (!entry) return null
  const rarity = entry.rarity ?? (isCurseCategory(entry.category) ? "cursed" : "rare")
  const tone = entry.kind === "curse" ? "jester" : (TONES[entry.category] ?? "absurd")
  return { tone, rarity, strong: rarity === "epic" || rarity === "legendary" }
}

export function markFor(title: string): MarkKind {
  return MARKS[title] ?? "skull"
}

export interface NameSplit {
  before: string
  match: string
  after: string
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}_]/u.test(ch)

// The first standalone mention of a name in a herald line, so a decoration can wrap exactly that word.
export function splitOnName(text: string, name: string): NameSplit | null {
  const needle = name.trim()
  if (!needle) return null
  const haystack = text.toLowerCase()
  const lower = needle.toLowerCase()
  let from = 0
  while (from <= haystack.length) {
    const at = haystack.indexOf(lower, from)
    if (at < 0) return null
    const end = at + lower.length
    if (!isWordChar(text[at - 1]) && !isWordChar(text[end])) {
      return { before: text.slice(0, at), match: text.slice(at, end), after: text.slice(end) }
    }
    from = at + 1
  }
  return null
}
