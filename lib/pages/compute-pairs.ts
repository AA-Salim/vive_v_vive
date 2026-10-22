import { winRate } from "@/lib/pages/compute-players"
import { DUO_BADGE_RULES } from "@/lib/pages/constants"
import { pairKey, type MatchData } from "@/lib/pages/matches"
import type { Duo, DuoBadge, Rivalry } from "@/lib/pages/types"

export { DUO_MIN_GAMES } from "@/lib/pages/constants"

export function computeRivalries(data: MatchData): Rivalry[] {
  const pairs = new Map<string, Rivalry>()
  for (const match of data.matches) {
    const { seats } = match
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        if (seats[i].side === seats[j].side) continue
        const [a, b] = pairKey(seats[i].playerId, seats[j].playerId)
        const seatA = seats[i].playerId === a ? seats[i] : seats[j]
        const seatB = seatA === seats[i] ? seats[j] : seats[i]
        const key = `${a}:${b}`
        const rivalry = pairs.get(key) ?? {
          a,
          b,
          games: 0,
          aWins: 0,
          bWins: 0,
          laneDuels: 0,
          aLaneWins: 0,
          bLaneWins: 0,
          lastPlayedAt: match.playedAt,
        }
        const aWon = seatA.side === match.winner
        rivalry.games++
        if (aWon) rivalry.aWins++
        else rivalry.bWins++
        if (seatA.lane === seatB.lane) {
          rivalry.laneDuels++
          if (aWon) rivalry.aLaneWins++
          else rivalry.bLaneWins++
        }
        rivalry.lastPlayedAt = match.playedAt
        pairs.set(key, rivalry)
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.games - x.games || y.laneDuels - x.laneDuels)
}

interface PairTally {
  a: string
  b: string
  games: number
  wins: number
  lastPlayedAt: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function computeDuos(data: MatchData): Duo[] {
  const totals = new Map<string, { games: number; wins: number }>()
  const pairs = new Map<string, PairTally>()

  for (const match of data.matches) {
    const { seats } = match
    for (const seat of seats) {
      const total = totals.get(seat.playerId) ?? { games: 0, wins: 0 }
      total.games++
      if (seat.side === match.winner) total.wins++
      totals.set(seat.playerId, total)
    }
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        if (seats[i].side !== seats[j].side) continue
        const [a, b] = pairKey(seats[i].playerId, seats[j].playerId)
        const key = `${a}:${b}`
        const tally = pairs.get(key) ?? { a, b, games: 0, wins: 0, lastPlayedAt: match.playedAt }
        tally.games++
        if (seats[i].side === match.winner) tally.wins++
        tally.lastPlayedAt = match.playedAt
        pairs.set(key, tally)
      }
    }
  }

  const name = (id: string) => data.players.get(id)?.name ?? "Someone"
  const overall = (id: string) => {
    const t = totals.get(id)
    return t ? winRate(t.wins, t.games) : 0
  }

  const duos: Duo[] = [...pairs.values()].map((p) => ({
    a: p.a,
    b: p.b,
    games: p.games,
    wins: p.wins,
    losses: p.games - p.wins,
    winRate: winRate(p.wins, p.games),
    headline: null,
    badges: [],
    lastPlayedAt: p.lastPlayedAt,
  }))
  duos.sort((x, y) => y.wins - x.wins || y.winRate - x.winRate || y.games - x.games)

  const strongerFirst = (d: Duo): [string, string] => (overall(d.a) >= overall(d.b) ? [d.a, d.b] : [d.b, d.a])

  const headlines: Array<(d: Duo) => DuoBadge> = [
    (d) => {
      const [strong, weak] = strongerFirst(d)
      return {
        id: "knees",
        label: "ON HIS KNEES",
        text: `${name(weak)} is on his knees for ${name(strong)}. ${plural(d.wins, "win")} served together.`,
        tone: "royal",
      }
    },
    (d) => {
      const [strong, weak] = strongerFirst(d)
      return {
        id: "daddy",
        label: "DADDY",
        text: `${name(strong)} is ${name(weak)}'s daddy. Carried him to ${plural(d.wins, "win")}.`,
        tone: "royal",
      }
    },
    (d) => {
      const [strong, weak] = strongerFirst(d)
      return {
        id: "ride_or_die",
        label: "RIDE OR DIE",
        text: `${name(weak)} rides or dies with ${name(strong)}. ${d.winRate >= 50 ? "Mostly rides." : "Mostly dies."}`,
        tone: "royal",
      }
    },
  ]
  headlines.forEach((make, i) => {
    if (duos[i]) duos[i].headline = make(duos[i])
  })

  // Each honor goes to exactly one duo, so a badge stays a story instead of wallpaper.
  const qualified = duos.filter((d) => d.games >= DUO_BADGE_RULES.minGames)
  const extreme = (list: Duo[], score: (d: Duo) => number) =>
    list.reduce<Duo | null>((best, d) => {
      if (!best) return d
      const diff = score(d) - score(best)
      return diff > 0 || (diff === 0 && d.games > best.games) ? d : best
    }, null)

  const dynasty = extreme(qualified, (d) => d.winRate)
  if (dynasty && dynasty.winRate >= DUO_BADGE_RULES.dynastyRate) {
    dynasty.badges.push({
      id: "dynasty",
      label: "THE DYNASTY",
      text: `${name(dynasty.a)} and ${name(dynasty.b)} win ${dynasty.winRate}% together. Hide the Nexus.`,
      tone: "royal",
    })
  }

  const cursed = extreme(qualified, (d) => -d.winRate)
  if (cursed && cursed !== dynasty && cursed.winRate < DUO_BADGE_RULES.cursedRate) {
    cursed.badges.push({
      id: "cursed",
      label: "CURSED BOND",
      text: `${plural(cursed.wins, "win")} in ${plural(cursed.games, "game")} together. The Rift has filed a restraining order.`,
      tone: "roast",
    })
  }

  const inseparable = extreme(qualified, (d) => d.games)
  if (inseparable) {
    inseparable.badges.push({
      id: "inseparable",
      label: "INSEPARABLE",
      text: `${plural(inseparable.games, "game")} side by side. The randomizer keeps pairing them. Suspicious.`,
      tone: "hype",
    })
  }

  const carried = qualified.filter(
    (d) => d.winRate >= DUO_BADGE_RULES.carryRate && Math.abs(overall(d.a) - overall(d.b)) >= DUO_BADGE_RULES.carryGap
  )
  const carry = extreme(carried, (d) => Math.abs(overall(d.a) - overall(d.b)))
  if (carry) {
    const [carrier, passenger] = strongerFirst(carry)
    carry.badges.push({
      id: "carry",
      label: "THE CARRY",
      text: `${name(carrier)} does the carrying. ${name(passenger)} enjoys the view.`,
      tone: "hype",
    })
  }

  let leech: { duo: Duo; self: string; mate: string; withRate: number; withoutRate: number } | null = null
  for (const d of qualified) {
    for (const [self, mate] of [
      [d.a, d.b],
      [d.b, d.a],
    ]) {
      const total = totals.get(self)
      if (!total || total.games - d.games < DUO_BADGE_RULES.minGames) continue
      const withoutRate = winRate(total.wins - d.wins, total.games - d.games)
      if (d.winRate < DUO_BADGE_RULES.leechWithRate || withoutRate >= DUO_BADGE_RULES.leechWithoutRate) continue
      if (!leech || d.winRate - withoutRate > leech.withRate - leech.withoutRate) {
        leech = { duo: d, self, mate, withRate: d.winRate, withoutRate }
      }
    }
  }
  if (leech) {
    leech.duo.badges.push({
      id: "nothing_without",
      label: "NOTHING WITHOUT HIM",
      text: `${name(leech.self)} wins ${leech.withRate}% with ${name(leech.mate)} and ${leech.withoutRate}% without him. Draw your own conclusions.`,
      tone: "roast",
    })
  }

  return duos
}
