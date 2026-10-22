import { PRAISE_REWARD } from "@/lib/praise/rules"
import { titleRulesV2 } from "@/lib/titles/rules-version"

// Mirrored in supabase/phase10_title-effects.sql (title_tiers, vvv_title_tier_price): keep both in sync.
// Prices are counted in hand kisses of 100 points (what one kiss, then one written praise, paid before the
// short-line praise went to PRAISE_REWARD): a Legendary title costs fifteen of them. Prices did not follow the raise.
export const HAND_KISS = 100

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
  return TIER_MULTIPLIER[tier] * HAND_KISS
}

// How many games a bought self title lasts before it needs renewing (vvv_title_games in
// supabase/phase10_title-effects.sql). A game counts when its owner played, bet, cast a decree, dueled or sealed a
// prophecy on it while wearing the title. Free honors never expire; curses keep their own burn.
export const TIER_GAMES: Record<PriceTier, number> = {
  legendary: 20,
  epic: 16,
  rare: 12,
  common: 8,
}

// Games a purchase buys, or null when the title never expires (honors, curses, or the first rules).
export function titleGames(tier: PriceTier, category: string, price: number): number | null {
  if (!titleRulesV2() || category === "award" || category === "mockery" || price <= 0) return null
  return TIER_GAMES[tier]
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

// The court still counts in hand kisses of HAND_KISS points, whatever the praise pays now.
export function multiplierLabel(tier: PriceTier): string {
  return `x${TIER_MULTIPLIER[tier]} the hand kiss`
}

export const HAND_KISS_NOTE = `One hand kiss is ${HAND_KISS} points. A daily praise now pays ${PRAISE_REWARD}.`

export const formatPrice = (n: number) => n.toLocaleString("en-US")
