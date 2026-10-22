import type { LoreLine } from "@/lib/lore/segments"
import type { Role, Side } from "@/lib/types"

export type ChronicleKind =
  | "opening"
  | "champion"
  | "cursed"
  | "salaxe"
  | "tribunal"
  | "wager"
  | "allin"
  | "decree"
  | "treasury"
  | "closing"

export interface ChronicleEntry extends LoreLine {
  kind: ChronicleKind
}

export interface ChronicleGame {
  id: string
  sessionId: string | null
  playedAt: string
  winner: Side
  mvp: string | null
  inter: string | null
  salaxe: { won: boolean; champion: string; lane: Role } | null
}

export interface ChronicleStats {
  games: number
  blueWins: number
  redWins: number
  canceled: number
  bets: number
  wagered: number
  decrees: number
  decreeSpend: number
  players: number
}

export interface ChronicleNight {
  id: string
  startedAt: string
  endedAt: string
  ongoing: boolean
  episode: LoreLine
  games: ChronicleGame[]
  stats: ChronicleStats
  entries: ChronicleEntry[]
}

export type GazetteKind = "leader" | "pauper" | "salaxe" | "shamed" | "verdict"

export interface GazetteFact extends LoreLine {
  kind: GazetteKind
}

export interface ChronicleResponse {
  generatedAt: string
  night: ChronicleNight | null
  gazette: GazetteFact[]
}
