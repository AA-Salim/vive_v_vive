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
