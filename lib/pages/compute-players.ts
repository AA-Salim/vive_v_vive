import type { ChampionLookup } from "@/lib/pages/champion-index"
import { RATE_MIN_GAMES } from "@/lib/pages/constants"
import type { MatchData } from "@/lib/pages/matches"
import type { ChampionRecord, LaneRecord, Outcome, PlayerRef, PlayerStat, SideRecord, StatsRecord, Streak } from "@/lib/pages/types"
import type { Role } from "@/lib/types"

const FORM_LENGTH = 5

interface Tally {
  games: number
  wins: number
}

interface Accumulator {
  ref: PlayerRef
  results: Outcome[]
  lanes: Map<Role, Tally>
  champions: Map<string, Tally>
  blue: SideRecord
  red: SideRecord
  lastPlayedAt: string | null
}

export function winRate(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 1000) / 10 : 0
}

function bump<K>(map: Map<K, Tally>, key: K, won: boolean) {
  const tally = map.get(key) ?? { games: 0, wins: 0 }
  tally.games++
  if (won) tally.wins++
  map.set(key, tally)
}

export function readStreaks(results: Outcome[]): { current: Streak | null; bestWin: number; worstLoss: number } {
  let bestWin = 0
  let worstLoss = 0
  let run = 0
  let previous: Outcome | null = null
  for (const result of results) {
    run = result === previous ? run + 1 : 1
    previous = result
    if (result === "W") bestWin = Math.max(bestWin, run)
    else worstLoss = Math.max(worstLoss, run)
  }
  return { current: previous ? { outcome: previous, count: run } : null, bestWin, worstLoss }
}

const byGamesThenWins = (x: Tally, y: Tally) => y.games - x.games || y.wins - x.wins

export function computePlayerStats(data: MatchData, internalOf: ChampionLookup): PlayerStat[] {
  const accumulators = new Map<string, Accumulator>()
  for (const match of data.matches) {
    for (const seat of match.seats) {
      const ref = data.players.get(seat.playerId)
      if (!ref) continue
      let acc = accumulators.get(seat.playerId)
      if (!acc) {
        acc = {
          ref,
          results: [],
          lanes: new Map(),
          champions: new Map(),
          blue: { games: 0, wins: 0 },
          red: { games: 0, wins: 0 },
          lastPlayedAt: null,
        }
        accumulators.set(seat.playerId, acc)
      }
      const won = seat.side === match.winner
      acc.results.push(won ? "W" : "L")
      bump(acc.lanes, seat.lane, won)
      bump(acc.champions, seat.champion, won)
      const side = acc[seat.side]
      side.games++
      if (won) side.wins++
      acc.lastPlayedAt = match.playedAt
    }
  }

  return [...accumulators.values()].map((acc) => {
    const wins = acc.results.filter((r) => r === "W").length
    const games = acc.results.length
    const { current, bestWin, worstLoss } = readStreaks(acc.results)
    const lanes: LaneRecord[] = [...acc.lanes.entries()]
      .map(([lane, t]) => ({ lane, ...t }))
      .sort(byGamesThenWins)
    const champions: ChampionRecord[] = [...acc.champions.entries()]
      .map(([name, t]) => ({ name, internal: internalOf(name), ...t }))
      .sort((x, y) => byGamesThenWins(x, y) || x.name.localeCompare(y.name))
    return {
      ...acc.ref,
      games,
      wins,
      losses: games - wins,
      winRate: winRate(wins, games),
      form: acc.results.slice(-FORM_LENGTH).reverse(),
      streak: current,
      bestWinStreak: bestWin,
      worstLossStreak: worstLoss,
      lanes,
      champions: champions.slice(0, 3),
      uniqueChampions: champions.length,
      blue: acc.blue,
      red: acc.red,
      lastPlayedAt: acc.lastPlayedAt,
    }
  })
}

function pick(
  stats: PlayerStat[],
  score: (s: PlayerStat) => number,
  eligible: (s: PlayerStat) => boolean = () => true
): PlayerStat | null {
  let best: PlayerStat | null = null
  let bestScore = -Infinity
  for (const s of stats) {
    if (!eligible(s)) continue
    const value = score(s)
    if (value > bestScore || (value === bestScore && best && s.games > best.games)) {
      best = s
      bestScore = value
    }
  }
  return best && bestScore > 0 ? best : null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

const ref = (s: PlayerStat): PlayerRef => ({ id: s.id, name: s.name, avatarUrl: s.avatarUrl, userId: s.userId })

export function computeRecords(stats: PlayerStat[]): StatsRecord[] {
  const records: StatsRecord[] = []
  const add = (id: string, label: string, quip: string, holder: PlayerStat | null, value: (s: PlayerStat) => string) => {
    if (holder) records.push({ id, label, quip, player: ref(holder), value: value(holder) })
  }

  add("most_wins", "Most victories", "Real ones. Not the delayed kind.", pick(stats, (s) => s.wins), (s) =>
    plural(s.wins, "win")
  )
  add(
    "best_rate",
    "Sharpest blade",
    `Best win rate, ${RATE_MIN_GAMES}+ games. No tourists.`,
    pick(stats, (s) => s.winRate, (s) => s.games >= RATE_MIN_GAMES),
    (s) => `${s.winRate}%`
  )
  add("iron_man", "Iron man", "Has anyone seen him touch grass?", pick(stats, (s) => s.games), (s) => plural(s.games, "game"))
  add(
    "hot_streak",
    "On fire",
    "Longest winning run still alive. Somebody gank him.",
    pick(stats, (s) => (s.streak?.outcome === "W" && s.streak.count >= 2 ? s.streak.count : 0)),
    (s) => `${s.streak?.count ?? 0} straight`
  )
  add(
    "cold_streak",
    "Delayed victory tour",
    "Longest losing run still alive. The win is coming. Allegedly.",
    pick(stats, (s) => (s.streak?.outcome === "L" && s.streak.count >= 2 ? s.streak.count : 0)),
    (s) => `${s.streak?.count ?? 0} straight`
  )
  add("golden_era", "Golden era", "Longest win streak ever recorded.", pick(stats, (s) => s.bestWinStreak), (s) =>
    plural(s.bestWinStreak, "win")
  )
  add(
    "champion_ocean",
    "Randomizer's toy",
    "Most different champions played. The dice love him.",
    pick(stats, (s) => s.uniqueChampions),
    (s) => plural(s.uniqueChampions, "champion")
  )
  return records
}
