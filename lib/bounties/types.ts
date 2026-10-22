import type { Role } from "@/lib/types"

export interface PersonRef {
  userId: string | null
  name: string
  avatarUrl: string | null
}

export interface TargetRef {
  playerId: string
  name: string
  userId: string | null
  avatarUrl: string | null
}

export interface RosterPlayer extends TargetRef {
  isActive: boolean
}

export interface WarrantBacker {
  userId: string
  name: string
  avatarUrl: string | null
  amount: number
}

export interface WarrantView {
  id: string
  // "legacy": a pre-warrant bounty with one poster and the old terms (1.5x back to the poster).
  kind: "warrant" | "legacy"
  target: TargetRef
  pledged: number
  crownBonus: number
  price: number
  escapes: number
  openedAt: string
  expiresAt: string
  backers: WarrantBacker[]
  mine: number
  nextEscapeBonus: number
  legacyPayout: number | null
}

export interface HuntHunter {
  userId: string
  name: string
  share: number
}

export interface HuntRecord {
  id: string
  outcome: "claimed" | "expired"
  target: TargetRef
  price: number
  escapes: number
  backers: number
  closedAt: string
  hunters: HuntHunter[]
}

export interface BoardViewer {
  userId: string | null
  playerId: string | null
}

export interface BountyBoard {
  available: boolean
  warrants: WarrantView[]
  recent: HuntRecord[]
  viewer: BoardViewer
}

export interface PledgeInput {
  targetPlayerId: string
  amount: number
}

export interface PledgeResult {
  created: boolean
  pledged: number
  price: number
  mine: number
  backers: number
  balance: number | null
  targetName: string
}

export type PilloryKind = "user" | "tribunal"

export interface PilloryLoss {
  champion: string
  lane: string
  playedAt: string
}

export interface TribunalVerdict {
  votes: number
  ballots: number
  champion: string | null
  lane: Role | null
  shared: boolean
}

export interface PilloryEntryView {
  id: string
  kind: PilloryKind
  target: TargetRef
  shamer: PersonRef | null
  message: string
  stat: { label: string; value: string }
  recentLosses: PilloryLoss[]
  createdAt: string
  expiresAt: string
  eggs: number
  thrown: boolean
  cost: number | null
  tribunal: TribunalVerdict | null
}

export interface PilloryViewer extends BoardViewer {
  nextPostAt: string | null
}

export interface PilloryWall {
  available: boolean
  entries: PilloryEntryView[]
  viewer: PilloryViewer
}

export type ShameStatKey =
  | "streak"
  | "week"
  | "champion"
  | "lane"
  | "hiding"
  | "last"
  | "career"
  | "ghost"
  | "clean"

export interface ShameStat {
  key: ShameStatKey
  label: string
  value: string
  severity: number
  // Raw numbers the roast templates interpolate (champion, lane, wins, losses, rate, count).
  facts: Record<string, string | number>
}

export interface PilloryPreview {
  playerId: string
  name: string
  stat: ShameStat
  alternatives: ShameStat[]
  recentLosses: PilloryLoss[]
}

export interface PilloryPostInput {
  targetPlayerId: string
  message: string
  statKey?: ShameStatKey | null
}

export interface PilloryPostResult {
  entryId: string
  balance: number | null
  targetName: string
  expiresAt: string
}

export interface EggResult {
  entryId: string
  eggs: number
  expiresAt: string
  extended: boolean
}
