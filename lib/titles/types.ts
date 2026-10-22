import type { MilestoneDefinition } from "@/lib/milestones"
import type { EffectDomain, TitleEffectLine } from "@/lib/titles/effects"
import type { LoadoutSlot } from "@/lib/titles/loadout"
import type { PriceTier } from "@/lib/titles/pricing"

export type { EffectDomain, TitleEffectLine } from "@/lib/titles/effects"
export type { LoadoutSlot } from "@/lib/titles/loadout"
export type { PriceTier } from "@/lib/titles/pricing"

export type TitleCategory = "rebellion" | "mockery" | "loyalty" | "absurd" | "award"

export type TitleRarity = "common" | "rare" | "epic" | "legendary" | "cursed"

export type PerkKind = "perk" | "curse"

export type PerkTrigger =
  | "win"
  | "loss"
  | "play"
  | "bet_win"
  | "bet_loss"
  | "bet_any"
  | "crown_falls"
  | "crown_wins"
  | "chance"
  | "pool"
  | "chaos"
  | "bounty"

export interface PerkInfo {
  kind: PerkKind
  trigger: PerkTrigger
  summary: string
  cap: number
  // The most a bad game can take from a perk wearer (Baron calls, plot twists).
  downside?: number
}

export interface CurseState {
  active: boolean
  served: number
  left: number
  total: number
  dignity_cost: number
}

export interface TitleView {
  id: string
  name: string
  description: string
  price: number
  category: TitleCategory
  for_self: boolean
  is_permanent: boolean
  rarity: TitleRarity
  perk: PerkInfo | null
  holders: number
  wearing: number
  // Price and slot tier (curses have one too: it sets their price). Free honors keep price 0.
  tier: PriceTier
  slot: LoadoutSlot
  // Immediate effects while equipped (curses: while the brand burns). Empty for cosmetic titles.
  effects: TitleEffectLine[]
  domain: EffectDomain | null
  // Curses only: what burning the brand off costs the branded.
  dignity_cost: number | null
}

export interface CourtMemberRef {
  id: string
  name: string
}

export interface OwnedTitleView {
  title_id: string
  is_active: boolean
  equipped_at?: string | null
  acquired_at: string
  bestowed_by: CourtMemberRef | null
  curse: CurseState | null
  perk: PerkInfo | null
}

export interface LedgerItem {
  id: string
  at: string
  title: string | null
  kind: PerkKind | "tribute"
  amount: number
  detail: string
}

export interface PerkLedger {
  perks: number
  tributes: number
  recent: LedgerItem[]
}

export interface TitlesCatalogResponse {
  titles: TitleView[]
  owned: string[]
  // The primary title of the loadout (highest tier, then most recently equipped).
  active_title_id: string | null
  // Every equipped title.
  active_title_ids: string[]
  // False until supabase/phase10_title-effects.sql has run: only one title can be worn.
  loadouts: boolean
  collection: OwnedTitleView[]
  balance: number | null
  locked: boolean
  ledger: PerkLedger | null
  migrated: boolean
}

export interface CourtMember {
  id: string
  name: string
  username: string
  avatar_url: string | null
  // Primary title; loadout lists every equipped title.
  equipped: string | null
  loadout?: string[]
  curses: { title: string; left: number }[]
  owned_title_ids: string[]
}

export interface CourtResponse {
  members: CourtMember[]
}

export interface CurseBadge {
  title: string
  perk: string
  bestowedBy: string | null
  gamesLeft: number
  // The curse's immediate effect, one sentence.
  effect?: string | null
  tier?: PriceTier
  cap?: number
  price?: number
  dignityCost?: number
}

export interface LoadoutEntry {
  title: string
  category: string
  rarity: TitleRarity
  tier: PriceTier
  slot: LoadoutSlot
  // Immediate effect, one sentence, or null for a cosmetic title.
  effect: string | null
  perk: string | null
  primary: boolean
}

// Extends the original { userId, playerId, title, category, perk } contract with optional fields only. The top-level
// fields describe the primary title (highest tier equipped); loadout lists every equipped title, primary first.
export interface EquippedTitle {
  userId: string
  playerId: string | null
  title: string
  category: string
  perk: string | null
  kind?: PerkKind | "cosmetic"
  rarity?: TitleRarity
  price?: number
  curses?: CurseBadge[]
  tier?: PriceTier
  effect?: string | null
  loadout?: LoadoutEntry[]
}

export interface MilestoneView extends MilestoneDefinition {
  current: number
  unlocked: boolean
  claimed: boolean
  perk: PerkInfo | null
  rarity: TitleRarity
}

export interface MilestonesResponse {
  milestones: MilestoneView[]
}

export interface TitlePayoutItem {
  id: string
  title: string | null
  kind: PerkKind | "tribute"
  amount: number
  detail: string
  // Whoever is on the other end: the brander a curse paid, or the branded who paid a tribute.
  counterpart: string | null
}

export interface TitlePayoutsResponse {
  items: TitlePayoutItem[]
  total: number
}
