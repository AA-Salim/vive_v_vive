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

export type GameMode = "standard" | "coach_draft" | "vainqueur"

export type SessionStatus =
  | "coach_draft"
  | "draft"
  | "chaos"
  | "betting"
  | "in_game"
  | "blue_win"
  | "red_win"
  | "canceled"
  | "expired"

export interface GameSession {
  id: string
  status: SessionStatus
  game_mode: GameMode
  created_by: string | null
  resolved_by: string | null
  game_id: string | null
  betting_ends_at: string | null
  chaos_ends_at: string | null
  blue_coach_id: string | null
  red_coach_id: string | null
  draft_turn: Side | null
  created_at: string
  updated_at: string
}

export interface CoachDraftPick {
  id: string
  session_id: string
  pick_number: number
  player_id: string
  side: Side
  lane: Role | null
  created_at: string
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
  | "chaos_spent"
  | "chaos_won"
  | "chaos_refunded"
  | "insurance_bought"
  | "insurance_payout"
  | "insurance_refunded"
  | "shame_spent"

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
  insured: boolean
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
  insured: boolean
  discord_username: string
  discord_avatar_url: string | null
}

export interface ShameEntry {
  id: string
  shamer_user_id: string
  target_player_id: string
  message: string
  worst_stat_label: string
  worst_stat_value: string
  recent_losses: {
    played_at: string
    champion: string
    lane: string
    winner_side: string
    player_side: string
  }[]
  expires_at: string
  created_at: string
  shamer_username?: string
  shamer_avatar_url?: string | null
  target_player_name?: string
}

export type PlayerRevealState = "hidden" | "silhouette" | "shuffling" | "locking" | "revealed"

export type ChaosActionType =
  | "double_or_nothing"
  | "swap_teammate"
  | "reroll_self"
  | "shuffle_lanes"
  | "reroll_champs"
  | "target_reroll"

export type ChaosTier = "medium" | "high" | "super"

export interface ChaosAction {
  id: string
  session_id: string
  user_id: string
  action_type: ChaosActionType
  tier: ChaosTier
  cost: number
  side: Side | null
  target_player_id: string | null
  target_player_2_id: string | null
  target_team: Side | null
  payout: number | null
  status: "pending" | "won" | "lost" | "resolved" | "refunded"
  created_at: string
}

export interface ChaosActionWithNames extends ChaosAction {
  discord_username: string
  discord_avatar_url: string | null
  target_player_name: string | null
  target_player_2_name: string | null
}

export interface QueueEntry {
  id: string
  player_id: string
  position: number
  joined_at: string
  player_name?: string
}

export interface VainqueurState {
  id: string
  is_active: boolean
  winning_player_ids: string[]
  losing_player_ids: string[]
  loser_volunteers: string[]
  last_session_id: string | null
  updated_at: string
}
