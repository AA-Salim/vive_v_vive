import type { ChampionLookup } from "@/lib/pages/champion-index"
import { winRate } from "@/lib/pages/compute-players"
import type { MatchData } from "@/lib/pages/matches"
import type { ChampionStat } from "@/lib/pages/types"
import type { Role } from "@/lib/types"

interface Accumulator {
  games: number
  wins: number
  lanes: Map<Role, number>
  players: Map<string, { games: number; wins: number }>
  lastPlayedAt: string
}

export function computeChampionStats(data: MatchData, internalOf: ChampionLookup): ChampionStat[] {
  const champions = new Map<string, Accumulator>()
  for (const match of data.matches) {
    for (const seat of match.seats) {
      const acc = champions.get(seat.champion) ?? {
        games: 0,
        wins: 0,
        lanes: new Map(),
        players: new Map(),
        lastPlayedAt: match.playedAt,
      }
      const won = seat.side === match.winner
      acc.games++
      if (won) acc.wins++
      acc.lanes.set(seat.lane, (acc.lanes.get(seat.lane) ?? 0) + 1)
      const player = acc.players.get(seat.playerId) ?? { games: 0, wins: 0 }
      player.games++
      if (won) player.wins++
      acc.players.set(seat.playerId, player)
      acc.lastPlayedAt = match.playedAt
      champions.set(seat.champion, acc)
    }
  }

  return [...champions.entries()]
    .map(([name, acc]) => {
      let top: { id: string; games: number; wins: number } | null = null
      for (const [id, t] of acc.players) {
        if (!top || t.games > top.games || (t.games === top.games && t.wins > top.wins)) top = { id, ...t }
      }
      const topRef = top ? data.players.get(top.id) : undefined
      return {
        name,
        internal: internalOf(name),
        games: acc.games,
        wins: acc.wins,
        winRate: winRate(acc.wins, acc.games),
        lanes: [...acc.lanes.entries()].map(([lane, games]) => ({ lane, games })).sort((x, y) => y.games - x.games),
        players: acc.players.size,
        topPlayer: top && topRef ? { id: top.id, name: topRef.name, games: top.games, wins: top.wins } : null,
        lastPlayedAt: acc.lastPlayedAt,
      }
    })
    .sort((x, y) => y.games - x.games || y.winRate - x.winRate || x.name.localeCompare(y.name))
}
