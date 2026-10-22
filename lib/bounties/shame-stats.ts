import type { ShameStat } from "@/lib/bounties/types"
import type { Role } from "@/lib/types"

export interface PlayedGame {
  playedAt: string
  won: boolean
  champion: string
  lane: Role
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const LANE_LABELS: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support",
}

// Lane names as they read mid-sentence ("lost on Yone mid", "ADC").
export function laneWord(lane: string): string {
  return lane === "adc" ? "ADC" : lane
}

const pct = (wins: number, total: number) => (total > 0 ? Math.round((wins / total) * 100) : 0)

function record(games: PlayedGame[]) {
  const wins = games.filter((g) => g.won).length
  return { wins, losses: games.length - wins, total: games.length, rate: pct(wins, games.length) }
}

function groupBy<K extends string>(games: PlayedGame[], key: (g: PlayedGame) => K) {
  const groups = new Map<K, PlayedGame[]>()
  for (const game of games) {
    const k = key(game)
    groups.set(k, [...(groups.get(k) ?? []), game])
  }
  return groups
}

function losingStreak(games: PlayedGame[]): number {
  let streak = 0
  for (const game of games) {
    if (game.won) break
    streak++
  }
  return streak
}

function worstGroup<K extends string>(groups: Map<K, PlayedGame[]>, minGames: number) {
  let worst: { key: K; wins: number; losses: number; total: number; rate: number } | null = null
  for (const [key, games] of groups) {
    if (games.length < minGames) continue
    const r = record(games)
    if (!worst || r.rate < worst.rate || (r.rate === worst.rate && r.losses > worst.losses)) worst = { key, ...r }
  }
  return worst
}

// Every embarrassing fact the record supports, worst first. Never empty: a clean record is a crime too.
export function shameStats(games: PlayedGame[], now: number): ShameStat[] {
  const sorted = [...games].sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
  const stats: ShameStat[] = []
  if (sorted.length === 0) {
    return [{ key: "ghost", label: "Games played", value: "0. A myth.", severity: 10, facts: { count: 0 } }]
  }

  const streak = losingStreak(sorted)
  if (streak >= 2) {
    stats.push({ key: "streak", label: "Losing streak", value: `${streak} in a row`, severity: 40 + streak * 10, facts: { count: streak } })
  }

  const week = sorted.filter((g) => now - Date.parse(g.playedAt) < WEEK_MS)
  const weekRecord = record(week)
  if (week.length >= 3 && weekRecord.rate <= 40) {
    stats.push({
      key: "week",
      label: "This week",
      value: `${weekRecord.wins}-${weekRecord.losses} (${weekRecord.rate}%)`,
      severity: 30 + (50 - weekRecord.rate),
      facts: { ...weekRecord },
    })
  }
  if (week.length === 0) {
    stats.push({ key: "hiding", label: "Games this week", value: "0. Hiding in the fog", severity: 25, facts: { count: 0 } })
  }

  const champion = worstGroup(groupBy(sorted, (g) => g.champion), 2)
  if (champion && champion.rate <= 34) {
    stats.push({
      key: "champion",
      label: `On ${champion.key}`,
      value: `${champion.wins}-${champion.losses}`,
      severity: 20 + champion.losses * 6 + (champion.wins === 0 ? 15 : 0),
      facts: { champion: champion.key, wins: champion.wins, losses: champion.losses, rate: champion.rate },
    })
  }

  const lane = worstGroup(groupBy(sorted, (g) => g.lane), 3)
  if (lane && lane.rate <= 35) {
    stats.push({
      key: "lane",
      label: `${LANE_LABELS[lane.key]} record`,
      value: `${lane.wins}-${lane.losses} (${lane.rate}%)`,
      severity: 20 + Math.round((50 - lane.rate) / 2) + lane.losses * 2,
      facts: { lane: laneWord(lane.key), wins: lane.wins, losses: lane.losses, rate: lane.rate },
    })
  }

  const last = sorted[0]
  if (!last.won) {
    stats.push({
      key: "last",
      label: "Last game",
      value: `Lost on ${last.champion}`,
      severity: 15,
      facts: { champion: last.champion, lane: laneWord(last.lane) },
    })
  }

  const career = record(sorted)
  if (career.total >= 10 && career.rate < 50) {
    stats.push({
      key: "career",
      label: "Career",
      value: `${career.rate}% (${career.wins}-${career.losses})`,
      severity: 10 + (50 - career.rate),
      facts: { ...career },
    })
  }

  if (stats.length === 0) {
    stats.push({
      key: "clean",
      label: "Record",
      value: `${career.wins}-${career.losses} (${career.rate}%)`,
      severity: 1,
      facts: { ...career },
    })
  }

  return stats.sort((a, b) => b.severity - a.severity)
}
