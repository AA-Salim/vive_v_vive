import type { Rivalry } from "@/lib/pages/types"

export interface Feud {
  opponent: string
  games: number
  wins: number
  losses: number
  laneDuels: number
  laneWins: number
  laneLosses: number
  lastPlayedAt: string
  rivalry: Rivalry
}

// A rivalry seen from one side of the table.
export function feudOf(r: Rivalry, playerId: string): Feud {
  const isA = r.a === playerId
  return {
    opponent: isA ? r.b : r.a,
    games: r.games,
    wins: isA ? r.aWins : r.bWins,
    losses: isA ? r.bWins : r.aWins,
    laneDuels: r.laneDuels,
    laneWins: isA ? r.aLaneWins : r.bLaneWins,
    laneLosses: isA ? r.bLaneWins : r.aLaneWins,
    lastPlayedAt: r.lastPlayedAt,
    rivalry: r,
  }
}

export function feudsOf(rivalries: Rivalry[], playerId: string): Feud[] {
  return rivalries
    .filter((r) => r.a === playerId || r.b === playerId)
    .map((r) => feudOf(r, playerId))
    .sort((x, y) => y.games - x.games || y.laneDuels - x.laneDuels)
}

export interface Highlight {
  id: string
  label: string
  quip: string
  rivalry: Rivalry
  // The side that leads, shown first.
  leader: string
  trailer: string
  score: string
}

const lead = (r: Rivalry) => (r.aWins >= r.bWins ? { leader: r.a, trailer: r.b, hi: r.aWins, lo: r.bWins } : { leader: r.b, trailer: r.a, hi: r.bWins, lo: r.aWins })

export function highlightsOf(rivalries: Rivalry[]): Highlight[] {
  const out: Highlight[] = []
  const pick = (list: Rivalry[], score: (r: Rivalry) => number) =>
    list.reduce<Rivalry | null>((best, r) => (!best || score(r) > score(best) || (score(r) === score(best) && r.games > best.games) ? r : best), null)

  const taken = new Set<Rivalry>()
  const add = (id: string, label: string, quip: string, rivalry: Rivalry | null) => {
    if (!rivalry) return
    taken.add(rivalry)
    const l = lead(rivalry)
    out.push({ id, label, quip, rivalry, leader: l.leader, trailer: l.trailer, score: `${l.hi}-${l.lo}` })
  }
  const free = (r: Rivalry) => !taken.has(r)

  add("most", "The eternal war", "Most games on opposite sides.", pick(rivalries, (r) => r.games))
  add(
    "lopsided",
    "Owned",
    "The most one-sided feud, 6+ games.",
    pick(
      rivalries.filter((r) => r.games >= 6 && free(r)),
      (r) => Math.abs(r.aWins - r.bWins) / r.games
    )
  )
  add(
    "closest",
    "Knife edge",
    "Ten games or more and still nobody is sure.",
    pick(
      rivalries.filter((r) => r.games >= 10 && free(r)),
      (r) => r.games - 4 * Math.abs(r.aWins - r.bWins)
    )
  )
  return out
}

export function archNemesisOf(rivalries: Rivalry[]): Rivalry | null {
  return rivalries.reduce<Rivalry | null>(
    (best, r) => (!best || r.laneDuels > best.laneDuels || (r.laneDuels === best.laneDuels && r.games > best.games) ? r : best),
    null
  )
}
