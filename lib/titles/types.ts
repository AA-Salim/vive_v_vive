import type { MilestoneDefinition } from "@/lib/milestones"

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
}

export interface CourtMemberRef {
  id: string
  name: string
}

export interface OwnedTitleView {
  title_id: string
  is_active: boolean
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
  active_title_id: string | null
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
  equipped: string | null
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
}

// Extends the original { userId, playerId, title, category, perk } contract with optional fields only.
export interface EquippedTitle {
  userId: string
  playerId: string | null
  title: string
  category: string
  perk: string | null
  kind?: PerkKind | "cosmetic"
  rarity?: TitleRarity
  curses?: CurseBadge[]
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
