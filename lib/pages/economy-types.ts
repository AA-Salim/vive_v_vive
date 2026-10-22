import type { Season } from "@/lib/pages/types"
import type { ReasonGroup } from "@/lib/reasons"
import type { ActStatus } from "@/lib/types"

export interface ActRef {
  id: number
  number: number
  name: string
  subtitle: string | null
  startedAt: string
  // The purse every noble opened this act with.
  initialGrant?: number | null
}

export interface LeaderboardEntry {
  rank: number
  prev_rank: number | null
  user_id: string
  username: string
  avatar_url: string | null
  player_id: string | null
  player_name: string | null
  balance: number
  delta_24h: number
  last_change: number | null
  last_reason: string | null
  last_change_at: string | null
  total_kisses: number
  wins: number | null
  losses: number | null
  is_current_user: boolean
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  act: ActRef | null
  generatedAt: string
  season: Season | null
  // An archived act: its final standings as sealed when it closed, no live movement.
  sealed: boolean
}

export interface BalancePoint {
  at: string
  balance: number
  delta: number
}

export interface ReasonTotal {
  reason: string
  count: number
  total: number
}

export interface PointsHistoryResponse {
  balance: number
  act: ActRef | null
  since: string
  series: BalancePoint[]
  income: number
  spending: number
  transactions: number
  breakdown: ReasonTotal[]
  rank: number | null
  of: number
}

export interface ArchiveSummary {
  id: number
  number: number
  name: string
  subtitle: string | null
  status: ActStatus
  startedAt: string
  endedAt: string | null
  champion: { name: string; avatarUrl: string | null; balance: number } | null
  participants: number
  games: number
}

export interface ArchivesResponse {
  acts: ArchiveSummary[]
}

export interface ArchiveAward {
  id: string
  category: string
  title: string
  userId: string
  name: string
  avatarUrl: string | null
  value: string | null
  bonus: number
}

export interface ArchiveStanding {
  userId: string
  rank: number
  name: string
  username: string | null
  avatarUrl: string | null
  balance: number
  earned: number
  spent: number
  bets: number
  devotion: number
  games: number
  wins: number
  winRate: number | null
  shames: number
}

export interface ArchiveTimeline {
  days: string[]
  // One balance per day per user, aligned with days.
  series: { userId: string; name: string; values: number[] }[]
}

export interface ArchiveDetailResponse {
  act: ActRef & { status: ActStatus; endedAt: string | null }
  awards: ArchiveAward[]
  standings: ArchiveStanding[]
  timeline: ArchiveTimeline
  totals: { games: number; bets: number; wagered: number; decrees: number; devotion: number; transactions: number }
  bets: { userId: string; name: string; won: number; lost: number; refunded: number }[]
  spending: { group: ReasonGroup; label: string; total: number }[]
}
