import { MILESTONES } from "@/lib/milestones"
import { actAwardKind, isConsolationTitle, perkFor } from "@/lib/titles/perks"
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

const MILESTONE_TIER = (() => {
  const byGroup = new Map<string, string[]>()
  for (const m of MILESTONES) byGroup.set(m.group, [...(byGroup.get(m.group) ?? []), m.title])
  const tiers = new Map<string, TitleRarity>()
  for (const titles of byGroup.values()) {
    titles.forEach((title, index) => {
      tiers.set(title, index === titles.length - 1 ? "epic" : index === 0 ? "common" : "rare")
    })
  }
  return tiers
})()

export function isCurseCategory(category: string): boolean {
  return category === "mockery"
}

// Seeded shop prices, so a badge rendered from just a name and category still gets the right frame.
const SHOP_PRICES: Record<string, number> = {
  "Crown Thief": 60,
  "The Disrespector": 70,
  "The Usurper": 80,
  "The One Who Stopped Kneeling": 90,
  Kingslayer: 100,
  "Throne Polisher": 50,
  "Still Kneeling": 60,
  "The Holdout": 65,
  "Last Loyalist": 70,
  "Copium Dealer": 75,
  "Main Character (Self-Diagnosed)": 80,
  "Baron Caller (Derogatory)": 85,
  "The 0/8 Powerspike": 90,
  "Delayed Victory Specialist": 95,
  "El Goblino Pequeno": 100,
}

export function rarityOf(name: string, category: string, price?: number): TitleRarity {
  if (isCurseCategory(category)) return "cursed"
  if (category === "award") {
    if (actAwardKind(name)) return "legendary"
    if (isConsolationTitle(name)) return "common"
    return MILESTONE_TIER.get(name) ?? "rare"
  }
  return (price ?? SHOP_PRICES[name] ?? 0) >= 90 ? "epic" : "rare"
}

export function perkInfo(name: string, category: string, to = "whoever branded you"): PerkInfo | null {
  const def = perkFor(name, category)
  if (!def) return null
  return { kind: def.kind, trigger: def.trigger, summary: def.describe(to), cap: def.cap }
}
