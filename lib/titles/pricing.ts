import { PRAISE_REWARD } from "@/lib/praise/rules"

// Mirrored in supabase/phase10_title-effects.sql (title_tiers, vvv_title_tier_price): keep both in sync.
// Prices are counted in written praises: one praise pays PRAISE_REWARD, a Legendary title costs fifteen of them.

export type PriceTier = "legendary" | "epic" | "rare" | "common"

export const PRICE_TIERS: readonly PriceTier[] = ["legendary", "epic", "rare", "common"]

export const TIER_MULTIPLIER: Record<PriceTier, number> = {
  legendary: 15,
  epic: 10,
  rare: 6,
  common: 3,
}

export const TIER_LABEL: Record<PriceTier, string> = {
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  common: "Common",
}

export function tierPrice(tier: PriceTier): number {
  return TIER_MULTIPLIER[tier] * PRAISE_REWARD
}

// Every title sold in the armory, self titles and curses alike, ranked by what its immediate effect plus its
// post-game perk are worth.
export const SHOP_TIERS: Record<string, PriceTier> = {
  "The Usurper": "legendary",
  Kingslayer: "legendary",
  "Copium Dealer": "legendary",
  "Last Loyalist": "epic",
  "The One Who Stopped Kneeling": "epic",
  "Delayed Victory Specialist": "epic",
  "Crown Thief": "rare",
  "The Disrespector": "rare",
  "The Holdout": "rare",
  "Baron Caller (Derogatory)": "rare",
  "El Goblino Pequeno": "rare",
  "Main Character (Self-Diagnosed)": "rare",
  "The 0/8 Powerspike": "rare",
  "Still Kneeling": "common",
  "Throne Polisher": "common",

  "Court Jester": "legendary",
  "The Crawling One": "epic",
  "Boot Licker": "rare",
  "Royal Carpet": "rare",
  "Salaxe's Emotional Support": "common",
}

export function shopTier(name: string): PriceTier | null {
  return SHOP_TIERS[name] ?? null
}

// A title the seed does not know yet is ranked by its stored price.
export function tierForPrice(price: number): PriceTier {
  return PRICE_TIERS.find((tier) => price >= tierPrice(tier)) ?? "common"
}

export function shopPrice(name: string, fallback: number): number {
  const tier = shopTier(name)
  return tier ? tierPrice(tier) : fallback
}

// The hand kiss became the written praise; the court still counts in kisses.
export function multiplierLabel(tier: PriceTier): string {
  return `x${TIER_MULTIPLIER[tier]} the hand kiss`
}

export const HAND_KISS_NOTE = `One hand kiss (a written praise) pays ${PRAISE_REWARD} points.`

export const formatPrice = (n: number) => n.toLocaleString("en-US")
