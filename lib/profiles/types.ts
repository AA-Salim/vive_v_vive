import { z } from "zod"
import type { Outcome, PlayerRef, Streak } from "@/lib/pages/types"
import type { TitleRarity } from "@/lib/titles/types"
import type { ActStatus, Role, Side } from "@/lib/types"

export const PROFILE_RULES = {
  // Below this a win rate is a coin flip with extra steps; matches the leaderboard records.
  rateMinGames: 10,
  duoMinGames: 3,
  rivalMinGames: 3,
  recentGames: 10,
  topChampions: 8,
  bondsListed: 5,
} as const

// ?act=current (default), ?act=all or ?act=<act number>.
export const ScopeParam = z.union([z.enum(["current", "all"]), z.coerce.number().int().min(1).max(999)]).default("current")

export type ScopeRequest = z.infer<typeof ScopeParam>

export type ScopeKey = "all" | number

export interface ProfileSeason {
  key: ScopeKey
  number: number | null
  name: string
  subtitle: string | null
  status: ActStatus | null
  startedAt: string | null
  endedAt: string | null
  games: number
}

export interface ProfileRecord {
  games: number
  wins: number
  losses: number
  winRate: number
}

export interface ProfileLane {
  lane: Role
  games: number
  wins: number
  winRate: number
}

export interface ProfileChampion {
  name: string
  internal: string | null
  games: number
  wins: number
  winRate: number
}

export interface ProfileSeat {
  playerId: string
  name: string
  avatarUrl: string | null
  lane: Role
  champion: string
  internal: string | null
}

export interface ProfileGame {
  gameId: string
  playedAt: string
  won: boolean
  side: Side
  lane: Role
  champion: string
  internal: string | null
  teammates: ProfileSeat[]
  opponents: ProfileSeat[]
}

export interface ProfileBond {
  player: PlayerRef
  games: number
  wins: number
  losses: number
  winRate: number
}

export interface ProfileRivals {
  bestDuo: ProfileBond | null
  worstDuo: ProfileBond | null
  nemesis: ProfileBond | null
  prey: ProfileBond | null
  partners: ProfileBond[]
  foes: ProfileBond[]
}

export type LoadoutTier = "super" | "bronze" | "basic"

export interface LoadoutTitle {
  name: string
  category: string
  rarity: TitleRarity
  tier: LoadoutTier
  slot: number | null
  effect: string | null
  perk: string | null
  kind: "perk" | "curse" | "cosmetic"
}

export interface ProfileCurse {
  name: string
  perk: string
  bestowedBy: string | null
  gamesLeft: number
}

export interface ProfileTitles {
  // "loadout" when the court reports a full build, "single" when only the primary banner is known.
  source: "loadout" | "single"
  loadout: LoadoutTitle[]
  summary: string | null
  curses: ProfileCurse[]
  owned: number | null
}

export interface ProfilePraise {
  total: number
  songs: number
  kisses: number
  crowned: number | null
}

export interface ProfileBounty {
  price: number
  backers: number
  escapes: number
  openedAt: string
  expiresAt: string
}

export interface ProfileRank {
  rank: number
  of: number
  balance: number
  source: "treasury" | "archive"
}

export interface ProfileIdentity {
  id: string
  name: string
  isActive: boolean
  userId: string | null
  username: string | null
  avatarUrl: string | null
}

export interface PlayerProfileResponse {
  player: ProfileIdentity
  scope: ProfileSeason
  seasons: ProfileSeason[]
  record: ProfileRecord
  allTime: ProfileRecord
  form: Outcome[]
  streak: Streak | null
  bestWinStreak: number
  lastPlayedAt: string | null
  rank: ProfileRank | null
  lanes: ProfileLane[]
  champions: ProfileChampion[]
  uniqueChampions: number
  recent: ProfileGame[]
  rivals: ProfileRivals
  titles: ProfileTitles | null
  praise: ProfilePraise | null
  bounty: ProfileBounty | null
  generatedAt: string
}
