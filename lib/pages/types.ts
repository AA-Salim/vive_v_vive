import type { ActStatus, GameMode, Role, Side } from "@/lib/types"

export type Outcome = "W" | "L"

// An act seen as a stats season. Responses carry the one they were computed for: null means all time.
export interface Season {
  id: number
  number: number
  name: string
  status: ActStatus
  startedAt: string
  endedAt: string | null
}

export interface PlayerRef {
  id: string
  name: string
  avatarUrl: string | null
  userId: string | null
}

export interface Streak {
  outcome: Outcome
  count: number
}

export interface LaneRecord {
  lane: Role
  games: number
  wins: number
}

export interface ChampionRecord {
  name: string
  internal: string | null
  games: number
  wins: number
}

export interface SideRecord {
  games: number
  wins: number
}

export interface PlayerStat extends PlayerRef {
  games: number
  wins: number
  losses: number
  winRate: number
  // Most recent first.
  form: Outcome[]
  streak: Streak | null
  bestWinStreak: number
  worstLossStreak: number
  lanes: LaneRecord[]
  champions: ChampionRecord[]
  uniqueChampions: number
  blue: SideRecord
  red: SideRecord
  lastPlayedAt: string | null
}

export interface StatsRecord {
  id: string
  label: string
  quip: string
  player: PlayerRef
  value: string
}

export interface StatsResponse {
  totals: {
    games: number
    players: number
    blueWins: number
    redWins: number
    firstGameAt: string | null
    lastGameAt: string | null
  }
  players: PlayerStat[]
  records: StatsRecord[]
  season: Season | null
}

export interface Rivalry {
  // Ids are ordered: a < b.
  a: string
  b: string
  games: number
  aWins: number
  bWins: number
  laneDuels: number
  aLaneWins: number
  bLaneWins: number
  lastPlayedAt: string
}

export interface RivalriesResponse {
  players: PlayerRef[]
  rivalries: Rivalry[]
  season: Season | null
}

export interface MatchupSide {
  side: Side
  lane: Role
  champion: string
  internal: string | null
}

export interface MatchupGame {
  gameId: string
  playedAt: string
  winner: Side
  a: MatchupSide
  b: MatchupSide
  laneDuel: boolean
}

export interface RivalryDetailResponse {
  a: PlayerRef
  b: PlayerRef
  versus: MatchupGame[]
  together: { games: number; wins: number }
  // Games where both sat on the same side, newest first.
  allied: MatchupGame[]
  season: Season | null
}

export type BadgeTone = "royal" | "hype" | "roast"

export interface DuoBadge {
  id: string
  label: string
  text: string
  tone: BadgeTone
}

export interface Duo {
  a: string
  b: string
  games: number
  wins: number
  losses: number
  winRate: number
  headline: DuoBadge | null
  badges: DuoBadge[]
  lastPlayedAt: string
}

export interface DuosResponse {
  players: PlayerRef[]
  duos: Duo[]
  minGames: number
  season: Season | null
}

export interface ChampionStat {
  name: string
  internal: string | null
  games: number
  wins: number
  winRate: number
  lanes: { lane: Role; games: number }[]
  players: number
  topPlayer: { id: string; name: string; games: number; wins: number } | null
  lastPlayedAt: string
}

export interface PoolChampion {
  name: string
  internal: string
}

export interface ChampionsResponse {
  totals: { picks: number; unique: number; pool: number }
  champions: ChampionStat[]
  pools: Record<Role, PoolChampion[]>
  season: Season | null
}

export interface Matchup {
  player: PlayerRef
  games: number
  wins: number
  losses: number
}

export interface Partner {
  player: PlayerRef
  games: number
  wins: number
  winRate: number
}

export interface RecentGame {
  gameId: string
  playedAt: string
  won: boolean
  side: Side
  lane: Role
  champion: string
  internal: string | null
}

export interface PlayerDetailResponse {
  player: PlayerStat
  recent: RecentGame[]
  champions: ChampionRecord[]
  nemesis: Matchup | null
  prey: Matchup | null
  bestDuo: Partner | null
  worstDuo: Partner | null
  season: Season | null
}

export interface HistoryPlayer {
  playerId: string
  name: string
  side: Side
  lane: Role
  champion: string
  internal: string | null
}

export interface HistoryGame {
  id: string
  playedAt: string
  winner: Side
  players: HistoryPlayer[]
  session: { mode: GameMode; pool: number; bettors: number; decrees: number } | null
  verdict: { mvp: string[]; inter: string[] } | null
}

export interface HistoryResponse {
  games: HistoryGame[]
  nextCursor: string | null
  season: Season | null
}

export interface GameDetailResponse {
  game: HistoryGame
  // The act the game was played in, null when it fell between two acts.
  season: Season | null
}

export type * from "@/lib/pages/economy-types"
