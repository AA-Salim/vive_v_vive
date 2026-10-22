import type { Side } from "@/lib/types"

export interface PlayerRecord {
  name: string
  wins: number
  losses: number
}

export interface NightFacts {
  id: string
  ongoing: boolean
  games: number
  blueWins: number
  redWins: number
  best: PlayerRecord | null
  worst: PlayerRecord | null
  // null: there is no Salaxe player at all. games 0: he exists but sat the night out.
  salaxe: { wins: number; losses: number; champions: string[] } | null
  biggestWin: { name: string; stake: number; payout: number; profit: number; side: Side } | null
  biggestLoss: { name: string; loss: number; side: Side; insured: boolean } | null
  allInLosers: string[]
  decrees: {
    count: number
    spent: number
    caster: { name: string; count: number; tied: boolean } | null
    favorite: string | null
  }
  tribunal: { mvp: { name: string; count: number } | null; inter: { name: string; count: number } | null } | null
  treasury: { gainer: { name: string; delta: number } | null; loser: { name: string; delta: number } | null }
}

export interface GazetteFacts {
  day: string
  leader: { name: string; balance: number } | null
  pauper: { name: string; balance: number } | null
  salaxe: { wins: number; losses: number } | null
  shamed: { name: string; count: number } | null
  verdict: { mvp: string | null; inter: string | null } | null
}
