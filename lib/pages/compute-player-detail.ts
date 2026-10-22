import type { ChampionLookup } from "@/lib/pages/champion-index"
import { computePlayerStats, winRate } from "@/lib/pages/compute-players"
import type { MatchData } from "@/lib/pages/matches"
import type { ChampionRecord, Matchup, Partner, PlayerDetailResponse, RecentGame } from "@/lib/pages/types"

const RECENT_GAMES = 10
const MATCHUP_MIN_GAMES = 3
const PARTNER_MIN_GAMES = 4

interface Tally {
  games: number
  wins: number
}

export function computePlayerDetail(
  data: MatchData,
  internalOf: ChampionLookup,
  playerId: string
): PlayerDetailResponse | null {
  const own = data.matches.filter((m) => m.seats.some((s) => s.playerId === playerId))
  const stat = computePlayerStats({ matches: own, players: data.players }, internalOf).find((s) => s.id === playerId)
  if (!stat) return null

  const opponents = new Map<string, Tally>()
  const mates = new Map<string, Tally>()
  const champions = new Map<string, Tally>()
  const recent: RecentGame[] = []

  for (let i = own.length - 1; i >= 0; i--) {
    const match = own[i]
    const seat = match.seats.find((s) => s.playerId === playerId)
    if (!seat) continue
    const won = seat.side === match.winner
    if (recent.length < RECENT_GAMES) {
      recent.push({
        gameId: match.id,
        playedAt: match.playedAt,
        won,
        side: seat.side,
        lane: seat.lane,
        champion: seat.champion,
        internal: internalOf(seat.champion),
      })
    }
    const champ = champions.get(seat.champion) ?? { games: 0, wins: 0 }
    champ.games++
    if (won) champ.wins++
    champions.set(seat.champion, champ)
    for (const other of match.seats) {
      if (other.playerId === playerId) continue
      const book = other.side === seat.side ? mates : opponents
      const tally = book.get(other.playerId) ?? { games: 0, wins: 0 }
      tally.games++
      if (won) tally.wins++
      book.set(other.playerId, tally)
    }
  }

  const matchups: Matchup[] = [...opponents.entries()].flatMap(([id, t]) => {
    const player = data.players.get(id)
    return player && t.games >= MATCHUP_MIN_GAMES ? [{ player, games: t.games, wins: t.wins, losses: t.games - t.wins }] : []
  })
  const partners: Partner[] = [...mates.entries()].flatMap(([id, t]) => {
    const player = data.players.get(id)
    return player && t.games >= PARTNER_MIN_GAMES ? [{ player, games: t.games, wins: t.wins, winRate: winRate(t.wins, t.games) }] : []
  })

  const lossRate = (m: Matchup) => m.losses / m.games
  const nemesis = matchups
    .filter((m) => m.losses > m.wins)
    .sort((x, y) => y.losses - x.losses || lossRate(y) - lossRate(x))[0] ?? null
  const prey = matchups
    .filter((m) => m.wins > m.losses && m.player.id !== nemesis?.player.id)
    .sort((x, y) => y.wins - x.wins || lossRate(x) - lossRate(y))[0] ?? null
  const byRate = [...partners].sort((x, y) => y.winRate - x.winRate || y.games - x.games)
  const bestDuo = byRate[0] && byRate[0].winRate >= 50 ? byRate[0] : null
  const worst = byRate[byRate.length - 1]
  const worstDuo = worst && worst !== bestDuo && worst.winRate < 50 ? worst : null

  const championList: ChampionRecord[] = [...champions.entries()]
    .map(([name, t]) => ({ name, internal: internalOf(name), ...t }))
    .sort((x, y) => y.games - x.games || y.wins - x.wins || x.name.localeCompare(y.name))

  return { player: stat, recent, champions: championList.slice(0, 8), nemesis, prey, bestDuo, worstDuo }
}
