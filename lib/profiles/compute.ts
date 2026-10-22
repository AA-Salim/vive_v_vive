import { ALL_ROLES } from "@/lib/champions"
import type { ChampionLookup } from "@/lib/pages/champion-index"
import { readStreaks, winRate } from "@/lib/pages/compute-players"
import type { Outcome, PlayerRef, Streak } from "@/lib/pages/types"
import {
  PROFILE_RULES,
  type ProfileBond,
  type ProfileChampion,
  type ProfileGame,
  type ProfileLane,
  type ProfileRecord,
  type ProfileRivals,
  type ProfileSeat,
} from "@/lib/profiles/types"
import type { Role, Side } from "@/lib/types"

export interface OwnSeat {
  gameId: string
  playedAt: string
  winner: Side
  side: Side
  lane: Role
  champion: string
}

export interface OtherSeat {
  gameId: string
  playerId: string
  side: Side
  lane: Role
  champion: string
}

export interface Window {
  from: number
  to: number
}

export const ALL_TIME: Window = { from: -Infinity, to: Infinity }

export const inWindow = (window: Window, iso: string) => {
  const at = Date.parse(iso)
  return at >= window.from && at < window.to
}

interface Tally {
  games: number
  wins: number
}

function bump<K>(map: Map<K, Tally>, key: K, won: boolean) {
  const tally = map.get(key) ?? { games: 0, wins: 0 }
  tally.games++
  if (won) tally.wins++
  map.set(key, tally)
}

export function recordOf(seats: OwnSeat[]): ProfileRecord {
  const wins = seats.filter((s) => s.side === s.winner).length
  return { games: seats.length, wins, losses: seats.length - wins, winRate: winRate(wins, seats.length) }
}

const laneOrder = (lane: Role) => ALL_ROLES.indexOf(lane)

function bondsOf(book: Map<string, Tally>, roster: Map<string, PlayerRef>): ProfileBond[] {
  return [...book.entries()].flatMap(([id, t]) => {
    const player = roster.get(id)
    return player ? [{ player, games: t.games, wins: t.wins, losses: t.games - t.wins, winRate: winRate(t.wins, t.games) }] : []
  })
}

const byGames = (x: ProfileBond, y: ProfileBond) => y.games - x.games || y.winRate - x.winRate || x.player.name.localeCompare(y.player.name)

// Over a long season a 5-game fling should not outrank a 40-game marriage: the bar rises with games played.
const bondMinGames = (games: number, floor: number) => Math.max(floor, Math.ceil(games / 12))

function rivalsOf(mates: ProfileBond[], foes: ProfileBond[], games: number): ProfileRivals {
  const partners = mates.filter((b) => b.games >= bondMinGames(games, PROFILE_RULES.duoMinGames))
  const rivals = foes.filter((b) => b.games >= bondMinGames(games, PROFILE_RULES.rivalMinGames))

  const byRate = [...partners].sort((x, y) => y.winRate - x.winRate || y.games - x.games)
  const bestDuo = byRate[0] && byRate[0].winRate >= 50 ? byRate[0] : null
  const worst = byRate[byRate.length - 1]
  const worstDuo = worst && worst !== bestDuo && worst.winRate < 50 ? worst : null

  // Against a foe, "losses" are the games he won against this player.
  const lossRate = (b: ProfileBond) => b.losses / b.games
  const nemesis = rivals.filter((b) => b.losses > b.wins).sort((x, y) => y.losses - x.losses || lossRate(y) - lossRate(x))[0] ?? null
  const prey =
    rivals
      .filter((b) => b.wins > b.losses && b.player.id !== nemesis?.player.id)
      .sort((x, y) => y.wins - x.wins || lossRate(x) - lossRate(y))[0] ?? null

  return {
    bestDuo,
    worstDuo,
    nemesis,
    prey,
    partners: [...mates].sort(byGames).slice(0, PROFILE_RULES.bondsListed),
    foes: [...foes].sort(byGames).slice(0, PROFILE_RULES.bondsListed),
  }
}

export interface ScopedStats {
  record: ProfileRecord
  form: Outcome[]
  streak: Streak | null
  bestWinStreak: number
  lastPlayedAt: string | null
  lanes: ProfileLane[]
  champions: ProfileChampion[]
  uniqueChampions: number
  recent: ProfileGame[]
  rivals: ProfileRivals
}

// seats: this player's games in the chosen window, oldest first. others: every other seat of those games.
export function computeScoped(
  seats: OwnSeat[],
  others: OtherSeat[],
  roster: Map<string, PlayerRef>,
  internalOf: ChampionLookup
): ScopedStats {
  const results: Outcome[] = seats.map((s) => (s.side === s.winner ? "W" : "L"))
  const streaks = readStreaks(results)

  const lanes = new Map<Role, Tally>()
  const champions = new Map<string, Tally>()
  for (const seat of seats) {
    const won = seat.side === seat.winner
    bump(lanes, seat.lane, won)
    bump(champions, seat.champion, won)
  }

  const byGame = new Map<string, OtherSeat[]>()
  for (const seat of others) {
    const list = byGame.get(seat.gameId) ?? []
    list.push(seat)
    byGame.set(seat.gameId, list)
  }

  const mates = new Map<string, Tally>()
  const foes = new Map<string, Tally>()
  for (const seat of seats) {
    const won = seat.side === seat.winner
    for (const other of byGame.get(seat.gameId) ?? []) bump(other.side === seat.side ? mates : foes, other.playerId, won)
  }

  const toSeat = (other: OtherSeat): ProfileSeat[] => {
    const ref = roster.get(other.playerId)
    if (!ref) return []
    return [
      {
        playerId: ref.id,
        name: ref.name,
        avatarUrl: ref.avatarUrl,
        lane: other.lane,
        champion: other.champion,
        internal: internalOf(other.champion),
      },
    ]
  }
  const byLane = (x: ProfileSeat, y: ProfileSeat) => laneOrder(x.lane) - laneOrder(y.lane)

  const recent: ProfileGame[] = seats
    .slice(-PROFILE_RULES.recentGames)
    .reverse()
    .map((seat) => {
      const table = byGame.get(seat.gameId) ?? []
      return {
        gameId: seat.gameId,
        playedAt: seat.playedAt,
        won: seat.side === seat.winner,
        side: seat.side,
        lane: seat.lane,
        champion: seat.champion,
        internal: internalOf(seat.champion),
        teammates: table.filter((o) => o.side === seat.side).flatMap(toSeat).sort(byLane),
        opponents: table.filter((o) => o.side !== seat.side).flatMap(toSeat).sort(byLane),
      }
    })

  const championList: ProfileChampion[] = [...champions.entries()]
    .map(([name, t]) => ({ name, internal: internalOf(name), ...t, winRate: winRate(t.wins, t.games) }))
    .sort((x, y) => y.games - x.games || y.wins - x.wins || x.name.localeCompare(y.name))

  return {
    record: recordOf(seats),
    form: results.slice(-5).reverse(),
    streak: streaks.current,
    bestWinStreak: streaks.bestWin,
    lastPlayedAt: seats[seats.length - 1]?.playedAt ?? null,
    lanes: [...lanes.entries()]
      .map(([lane, t]) => ({ lane, ...t, winRate: winRate(t.wins, t.games) }))
      .sort((x, y) => y.games - x.games || y.wins - x.wins || laneOrder(x.lane) - laneOrder(y.lane)),
    champions: championList.slice(0, PROFILE_RULES.topChampions),
    uniqueChampions: championList.length,
    recent,
    rivals: rivalsOf(bondsOf(mates, roster), bondsOf(foes, roster), seats.length),
  }
}

// Standard competition ranking: equal balances share a rank (1, 2, 2, 4).
export function rankOf(balances: { user_id: string; balance: number }[], userId: string): { rank: number; of: number; balance: number } | null {
  const own = balances.find((b) => b.user_id === userId)
  if (!own) return null
  const ahead = balances.filter((b) => b.balance > own.balance).length
  return { rank: ahead + 1, of: balances.length, balance: own.balance }
}
