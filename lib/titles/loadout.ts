import type { PriceTier } from "@/lib/titles/pricing"
import { titleRulesV2 } from "@/lib/titles/rules-version"

// Mirrored in supabase/phase10_title-effects.sql (title_slot_rules, title_conflicts, vvv_loadout_violation): keep in sync.
// Curses never take a slot: a burning brand is always active. A mockery title worn as a banner is only a scar and
// sits in a Common slot.

export type LoadoutSlot = "super_rare" | "rare" | "common"

export const LOADOUT_SLOTS: readonly LoadoutSlot[] = ["super_rare", "rare", "common"]

export const SLOT_COUNT: Record<LoadoutSlot, number> = { super_rare: 2, rare: 3, common: 4 }

export const MAX_EQUIPPED = LOADOUT_SLOTS.reduce((sum, slot) => sum + SLOT_COUNT[slot], 0)

export const SLOT_LABEL: Record<LoadoutSlot, string> = {
  super_rare: "Super rare",
  rare: "Rare",
  common: "Common",
}

export const SLOT_HINT: Record<LoadoutSlot, string> = {
  super_rare: "Legendary and Epic titles",
  rare: "Rare titles",
  common: "Common titles, honors and worn scars",
}

export function slotOf(tier: PriceTier): LoadoutSlot {
  return tier === "legendary" || tier === "epic" ? "super_rare" : tier
}

export interface TitleConflict {
  titles: readonly [string, string]
  reason: string
}

// Super-broken pairs: two titles feeding the same strong effect. Everything else may be combined.
export const TITLE_CONFLICTS: readonly TitleConflict[] = [
  {
    titles: ["Copium Dealer", "The Holdout"],
    reason: "One Guardian Angel racket at a time: the angel only takes one bribe.",
  },
  {
    titles: ["El Goblino Pequeno", "Delayed Victory Specialist"],
    reason: "Two duel hustles at once: the tithe collector audits one of them.",
  },
]

// First title rules only: the second ones let rebels and loyalists share the super rare slots.
export const FACTION_REASON = "Rebels and loyalists never share the super rare slots: you cannot slay the King and polish his throne."

export function factionRule(): boolean {
  return !titleRulesV2()
}

export interface LoadoutItem {
  name: string
  category: string
  tier: PriceTier
}

export type LoadoutError =
  | { code: "slot_full"; slot: LoadoutSlot; message: string }
  | { code: "title_conflict"; with: string; message: string }
  | { code: "faction_conflict"; with: string; message: string }

export function loadoutSlotOf(item: LoadoutItem): LoadoutSlot {
  return item.category === "mockery" ? "common" : slotOf(item.tier)
}

function conflictBetween(a: LoadoutItem, b: LoadoutItem): LoadoutError | null {
  const pair = TITLE_CONFLICTS.find((c) => c.titles.includes(a.name) && c.titles.includes(b.name) && a.name !== b.name)
  if (pair) return { code: "title_conflict", with: b.name, message: `Clashes with ${b.name}. ${pair.reason}` }
  const factions = new Set([a.category, b.category])
  if (
    factionRule() &&
    loadoutSlotOf(a) === "super_rare" &&
    loadoutSlotOf(b) === "super_rare" &&
    factions.has("rebellion") &&
    factions.has("loyalty")
  ) {
    return { code: "faction_conflict", with: b.name, message: `Clashes with ${b.name}. ${FACTION_REASON}` }
  }
  return null
}

// Why `item` cannot join `current` (the titles already equipped), or null when it fits.
export function equipBlock(current: readonly LoadoutItem[], item: LoadoutItem): LoadoutError | null {
  const others = current.filter((c) => c.name !== item.name)
  const slot = loadoutSlotOf(item)
  const used = others.filter((c) => loadoutSlotOf(c) === slot).length
  if (used >= SLOT_COUNT[slot]) {
    return {
      code: "slot_full",
      slot,
      message: `Your ${SLOT_LABEL[slot]} slots are full (${used} of ${SLOT_COUNT[slot]}). Take one off first.`,
    }
  }
  for (const other of others) {
    const conflict = conflictBetween(item, other)
    if (conflict) return conflict
  }
  return null
}

// First rule a whole loadout breaks, or null. Same order as the SQL check.
export function loadoutViolation(items: readonly LoadoutItem[]): LoadoutError | null {
  for (let i = 0; i < items.length; i++) {
    const block = equipBlock(items.slice(0, i), items[i])
    if (block) return block
  }
  return null
}

const TIER_RANK: Record<PriceTier, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

// The primary title shown when only one fits: the highest tier, then the most recently equipped.
export function primaryOf<T extends LoadoutItem & { equippedAt?: string | null }>(items: readonly T[]): T | null {
  return (
    [...items].sort(
      (a, b) =>
        TIER_RANK[a.category === "mockery" ? "common" : a.tier] - TIER_RANK[b.category === "mockery" ? "common" : b.tier] ||
        Date.parse(b.equippedAt ?? "") - Date.parse(a.equippedAt ?? "") ||
        a.name.localeCompare(b.name)
    )[0] ?? null
  )
}
