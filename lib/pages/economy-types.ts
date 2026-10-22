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

// One praise on the Hall of Kisses, with what the ledger paid for it.
export interface KissPraise {
  id: string
  body: string
  createdAt: string
  praiseDay: string
  verdict: "crowned" | "scorned" | null
  verdictNote: string | null
  favor: number
  points: number
  // Its King's Riddle: first riddle posed to solve, and the riddles missed before. Null before the riddle clock.
  riddleMs: number | null
  riddleMisses: number | null
}

export interface KissEntry {
  rank: number
  userId: string
  playerId: string | null
  name: string
  avatarUrl: string | null
  kisses: number
  // reward + riddle + favor: everything the ledger paid for these praises.
  points: number
  reward: number
  riddle: number
  favor: number
  crowns: number
  scorns: number
  // Act I one-click kisses (and early praises whose text was never kept), counted apart from the points.
  legacy: number
  today: boolean
  // Praises sung today (up to the daily kisses).
  todayCount: number
  // Average riddle solve time of the timed praises in the window, and every riddle missed before them.
  avgRiddleMs: number | null
  riddleMisses: number
  lastAt: string | null
  recent: KissPraise[]
}

export interface KissBoardResponse {
  // false while the praises table itself is missing.
  available: boolean
  entries: KissEntry[]
  // today: subjects who kissed today; todayKisses: the kisses they gave.
  totals: { kisses: number; points: number; crowns: number; legacy: number; today: number; todayKisses: number }
  // The UTC day the daily praise counts in ("YYYY-MM-DD").
  today: string
  season: Season | null
  generatedAt: string
}
