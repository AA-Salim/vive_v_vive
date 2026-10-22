import { isCurseCategory, perkInfo, rarityOf } from "@/lib/titles/catalog"
import type { TitleRarity } from "@/lib/titles/types"
import type { LoadoutTier, LoadoutTitle, ProfileCurse, ProfileTitles } from "@/lib/profiles/types"

export interface TierSpec {
  tier: LoadoutTier
  label: string
  rarities: string
  slots: number
}

export const LOADOUT_TIERS: readonly TierSpec[] = [
  { tier: "super", label: "Super rare", rarities: "Legendary or Epic", slots: 2 },
  { tier: "bronze", label: "Rare", rarities: "Rare", slots: 3 },
  { tier: "basic", label: "Common", rarities: "Common", slots: 4 },
]

const RARITIES: readonly TitleRarity[] = ["common", "rare", "epic", "legendary", "cursed"]

type Loose = Record<string, unknown>

const isRecord = (value: unknown): value is Loose => !!value && typeof value === "object" && !Array.isArray(value)

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function count(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

export function tierOfRarity(rarity: TitleRarity): LoadoutTier {
  if (rarity === "legendary" || rarity === "epic") return "super"
  if (rarity === "rare") return "bronze"
  return "basic"
}

function tierOf(raw: unknown, rarity: TitleRarity): LoadoutTier {
  const value = typeof raw === "string" ? raw.toLowerCase() : ""
  if (value.includes("super") || value.includes("legend") || value.includes("epic")) return "super"
  if (value.includes("bronze") || value.includes("rare")) return "bronze"
  if (value.includes("basic") || value.includes("common")) return "basic"
  return tierOfRarity(rarity)
}

function perkText(value: unknown): string | null {
  if (isRecord(value)) return text(value.summary, value.text, value.description)
  return text(value)
}

function kindOf(raw: unknown, category: string, perk: string | null): LoadoutTitle["kind"] {
  if (raw === "perk" || raw === "curse" || raw === "cosmetic") return raw
  if (isCurseCategory(category)) return "curse"
  return perk ? "perk" : "cosmetic"
}

// Reads one loadout entry from the titles API without trusting its exact shape: the slot fields are still settling.
function readEntry(raw: unknown): LoadoutTitle | null {
  if (!isRecord(raw)) return null
  const name = text(raw.title, raw.name, isRecord(raw.title) ? raw.title.name : null)
  if (!name) return null
  const category = text(raw.category, isRecord(raw.title) ? raw.title.category : null) ?? ""
  const rarity = RARITIES.includes(raw.rarity as TitleRarity) ? (raw.rarity as TitleRarity) : rarityOf(name, category)
  const slot = isRecord(raw.slot) ? raw.slot : null
  const perk = perkText(raw.perk) ?? perkInfo(name, category)?.summary ?? null
  return {
    name,
    category,
    rarity,
    tier: tierOf(raw.tier ?? slot?.tier, rarity),
    slot: count(raw.slot, raw.slotIndex, raw.slot_index, raw.position, slot?.index, slot?.position),
    effect: perkText(raw.effect),
    perk,
    kind: kindOf(isRecord(raw.perk) ? raw.perk.kind : raw.kind, category, perk),
  }
}

function summaryOf(entry: Loose): string | null {
  const build = isRecord(entry.build) ? entry.build : isRecord(entry.loadoutMeta) ? entry.loadoutMeta : null
  return text(entry.buildSummary, entry.build_summary, entry.loadoutSummary, entry.loadout_summary, build?.summary, build?.text)
}

function cursesOf(entry: Loose): ProfileCurse[] {
  if (!Array.isArray(entry.curses)) return []
  return entry.curses.flatMap((raw): ProfileCurse[] => {
    if (!isRecord(raw)) return []
    const name = text(raw.title, raw.name)
    if (!name) return []
    return [
      {
        name,
        perk: perkText(raw.perk) ?? "",
        bestowedBy: text(raw.bestowedBy),
        gamesLeft: count(raw.gamesLeft) ?? 0,
      },
    ]
  })
}

const slotOrder = (x: LoadoutTitle, y: LoadoutTitle) => (x.slot ?? Number.MAX_SAFE_INTEGER) - (y.slot ?? Number.MAX_SAFE_INTEGER)

// One player's entry from GET /api/titles/equipped (or buildEquippedTitles): the full loadout when present,
// otherwise the single primary banner. Worn brands only count as curses, never as a slot.
export function readTitles(entry: unknown, owned: number | null = null): ProfileTitles | null {
  if (!isRecord(entry)) return null
  const curses = cursesOf(entry)
  const summary = summaryOf(entry)

  if (Array.isArray(entry.loadout)) {
    const loadout = entry.loadout
      .map(readEntry)
      .filter((t): t is LoadoutTitle => t !== null && t.kind !== "curse")
      .sort(slotOrder)
    return { source: "loadout", loadout, summary, curses, owned }
  }

  const primary = readEntry({ ...entry, effect: null })
  const loadout = primary && primary.kind !== "curse" ? [{ ...primary, slot: 0 }] : []
  return { source: "single", loadout, summary, curses, owned }
}

export function groupByTier(loadout: LoadoutTitle[]): { spec: TierSpec; titles: LoadoutTitle[]; empty: number }[] {
  return LOADOUT_TIERS.map((spec) => {
    const titles = loadout.filter((t) => t.tier === spec.tier)
    return { spec, titles, empty: Math.max(0, spec.slots - titles.length) }
  })
}

export const LOADOUT_CAPACITY = LOADOUT_TIERS.reduce((sum, t) => sum + t.slots, 0)
