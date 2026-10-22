import { MILESTONES } from "@/lib/milestones"
import { shopTier, tierForPrice, tierPrice, type PriceTier } from "@/lib/titles/pricing"
import { actAwardKind, isConsolationTitle, perkFor } from "@/lib/titles/perks"
import { PERK_CAP } from "@/lib/titles/rules"
import type { PerkInfo, TitleCategory, TitleRarity } from "@/lib/titles/types"

export const CATEGORY_META: Record<TitleCategory, { label: string; tagline: string }> = {
  rebellion: { label: "Rebellion", tagline: "For those who stopped kneeling. Paid when the crown falls." },
  loyalty: { label: "Loyalty", tagline: "For those still polishing an empty throne. Paid when he wins." },
  absurd: { label: "Absurd", tagline: "For the main characters of nobody's story." },
  mockery: { label: "Mockery", tagline: "Curses you bestow on others. They pay you tribute." },
  award: { label: "Honors", tagline: "Earned, never bought." },
}

export const RARITY_LABEL: Record<TitleRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  cursed: "Cursed",
}

// Honors are free but still take a loadout slot: the last title of a milestone group is Rare, the rest Common.
// Mirrored in supabase/phase10_title-effects.sql (title_tiers).
const MILESTONE_TIER = (() => {
  const byGroup = new Map<string, string[]>()
  for (const m of MILESTONES) byGroup.set(m.group, [...(byGroup.get(m.group) ?? []), m.title])
  const tiers = new Map<string, PriceTier>()
  for (const titles of byGroup.values()) {
    titles.forEach((title, index) => tiers.set(title, index === titles.length - 1 ? "rare" : "common"))
  }
  return tiers
})()

export const MILESTONE_TIERS: ReadonlyMap<string, PriceTier> = MILESTONE_TIER

export function isCurseCategory(category: string): boolean {
  return category === "mockery"
}

function awardTier(name: string): PriceTier {
  if (actAwardKind(name)) return "legendary"
  if (isConsolationTitle(name)) return "common"
  return MILESTONE_TIER.get(name) ?? "common"
}

// The price and slot tier. Curses have one too: it sets their price, they never take a slot.
export function tierOf(name: string, category: string, price?: number): PriceTier {
  if (category === "award") return awardTier(name)
  return shopTier(name) ?? tierForPrice(price ?? 0)
}

// The seeded armory price of a title, or null for honors and titles the seed does not know.
export function seededPrice(name: string): number | null {
  const tier = shopTier(name)
  return tier ? tierPrice(tier) : null
}

// The visual frame: a curse always looks cursed, everything else wears its tier.
export function rarityOf(name: string, category: string, price?: number): TitleRarity {
  return isCurseCategory(category) ? "cursed" : tierOf(name, category, price)
}

export function perkInfo(name: string, category: string, to = "whoever branded you"): PerkInfo | null {
  const def = perkFor(name, category)
  if (!def) return null
  const info: PerkInfo = { kind: def.kind, trigger: def.trigger, summary: def.describe(to), cap: Math.min(def.cap, PERK_CAP) }
  if (def.downside) info.downside = def.downside
  return info
}
