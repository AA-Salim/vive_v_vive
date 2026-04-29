export type Role = "top" | "jungle" | "mid" | "adc" | "support"

export type Side = "blue" | "red"

export interface Player {
  id: string
  name: string
  is_active: boolean
  wins: number
  losses: number
  games_played: number
  created_at: string
}

export interface Game {
  id: string
  played_at: string
  winner_side: Side
}

export interface GamePlayer {
  id: string
  game_id: string
  player_id: string
  side: Side
  lane: Role
  champion: string
}

export interface GameWithPlayers extends Game {
  game_players: (GamePlayer & { players: Pick<Player, "id" | "name"> })[]
}

export interface Assignment {
  player: Player
  side: Side
  lane: Role
  champion: string
  championInternal: string
  locked: boolean
  fearlessOverride: boolean
}

export interface PlayerStats extends Player {
  winRate: number
  mostPlayedChampion: string | null
  mostPlayedChampionInternal: string | null
  mostPlayedLane: Role | null
}

export type SessionStatus =
  | "draft"
  | "betting"
  | "in_game"
  | "blue_win"
  | "red_win"
  | "canceled"
  | "expired"

export interface GameSession {
  id: string
  status: SessionStatus
  created_by: string | null
  resolved_by: string | null
  game_id: string | null
  betting_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface SessionAssignment {
  id: string
  session_id: string
  player_id: string
  side: Side
  lane: Role
  champion: string
  champion_internal: string
  locked: boolean
  fearless_override: boolean
}

export interface SessionWithAssignments extends GameSession {
  session_assignments: (SessionAssignment & {
    players: Pick<Player, "id" | "name">
  })[]
}

export interface UserProfile {
  id: string
  discord_username: string
  discord_avatar_url: string | null
  player_id: string | null
  created_at: string
}

export interface PointBalance {
  user_id: string
  balance: number
  last_daily_claim: string | null
  updated_at: string
}

export type PointReason =
  | "initial_grant"
  | "daily_bonus"
  | "game_win"
  | "game_participation"
  | "bet_placed"
  | "bet_won"
  | "bet_refunded"
  | "kiss_the_hand"

export interface PointTransaction {
  id: string
  user_id: string
  amount: number
  reason: PointReason
  reference_id: string | null
  created_at: string
}

export interface Bet {
  id: string
  session_id: string
  user_id: string
  side: Side
  amount: number
  payout: number | null
  status: "pending" | "won" | "lost" | "refunded"
  created_at: string
}

export interface BettingPool {
  blue_total: number
  red_total: number
  total: number
  blue_multiplier: number | null
  red_multiplier: number | null
  bet_count: number
  user_bet: Bet | null
  bets?: BetDetail[]
}

export interface BetDetail {
  id: string
  user_id: string
  side: Side
  amount: number
  payout: number | null
  status: "pending" | "won" | "lost" | "refunded"
  discord_username: string
  discord_avatar_url: string | null
}

export type PlayerRevealState = "hidden" | "silhouette" | "shuffling" | "locking" | "revealed"
