import { betNet } from "@/lib/betting/math"
import type { BetRow } from "@/lib/betting/types"
import { decreeName } from "@/lib/chaos/catalog"
import type { NightFacts, PlayerRecord } from "@/lib/lore/chronicle/facts"
import { one, verdictNames, type ChaosRow, type GameRow, type VoteRow } from "@/lib/lore/chronicle/rows"
import type { ChronicleGame } from "@/lib/lore/chronicle/types"
import { isSalaxe } from "@/lib/lore/salaxe"

export const NIGHT_GAP_MS = 4 * 60 * 60_000
const DUPLICATE_MS = 5 * 60_000
const TREASURY_MIN = 20

// Games closer than four hours apart belong to the same night, starting from the latest one.
export function latestNight(gamesNewestFirst: GameRow[]): GameRow[] {
  if (gamesNewestFirst.length === 0) return []
  const night = [gamesNewestFirst[0]]
  for (let i = 1; i < gamesNewestFirst.length; i++) {
    const gap = Date.parse(night[night.length - 1].played_at) - Date.parse(gamesNewestFirst[i].played_at)
    if (!(gap <= NIGHT_GAP_MS)) break
    night.push(gamesNewestFirst[i])
  }
  return night.reverse()
}

function rosterKey(game: GameRow): string {
  const seats = (game.game_players ?? []).map((p) => `${p.player_id}:${p.side}`).sort()
  return `${seats.join(",")}|${game.winner_side}`
}

// A double-submitted result writes the same game twice within seconds: keep the copy a session points to.
export function dedupeGames(games: GameRow[], linked: Set<string>): GameRow[] {
  const kept: GameRow[] = []
  for (const game of games) {
    const key = rosterKey(game)
    const at = Date.parse(game.played_at)
    const twin = kept.findIndex((k) => rosterKey(k) === key && Math.abs(Date.parse(k.played_at) - at) <= DUPLICATE_MS)
    if (twin === -1) kept.push(game)
    else if (!linked.has(kept[twin].id) && linked.has(game.id)) kept[twin] = game
  }
  return kept
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Highest score wins; ties keep the earliest item.
function rank<T>(items: T[], score: (item: T) => number[]): T | null {
  let best: T | null = null
  let bestScore: number[] = []
  for (const item of items) {
    const s = score(item)
    if (best === null || compareScores(s, bestScore) > 0) {
      best = item
      bestScore = s
    }
  }
  return best
}

function topCount(names: string[]): { name: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  const winner = rank([...counts.entries()], ([, c]) => [c])
  return winner ? { name: winner[0], count: winner[1] } : null
}

const joinNames = (names: string[]) => (names.length > 0 ? names.join(" & ") : null)

export interface NightInput {
  id: string
  ongoing: boolean
  games: GameRow[]
  sessionByGame: Map<string, string>
  bets: BetRow[]
  decrees: ChaosRow[]
  votes: VoteRow[] | null
  net: Map<string, number>
  salaxeId: string | null
  playerName: (playerId: string) => string | null
  userName: (userId: string) => string | null
}

export function compileNight(input: NightInput): { facts: NightFacts; games: ChronicleGame[]; players: number } {
  const { games, sessionByGame, bets, decrees, votes, salaxeId, playerName, userName } = input
  const records = new Map<string, PlayerRecord>()
  const players = new Set<string>()
  const salaxe = { wins: 0, losses: 0, champions: [] as string[] }
  const voteBySession = new Map((votes ?? []).filter((v) => v.status === "settled").map((v) => [v.session_id, v]))
  const mvpNames: string[] = []
  const interNames: string[] = []

  const verdict = (vote: VoteRow | undefined, category: "mvp" | "inter") => {
    if (!vote) return [] as string[]
    const named = verdictNames(vote.summary?.[category]?.names)
    if (named.length > 0) return named
    const ids = (category === "mvp" ? vote.mvp_player_ids : vote.inter_player_ids) ?? []
    return ids.map(playerName).filter((n): n is string => !!n)
  }

  const chronicleGames = games.map<ChronicleGame>((game) => {
    let salaxeSeat: ChronicleGame["salaxe"] = null
    for (const seat of game.game_players ?? []) {
      const name = one(seat.players)?.name ?? playerName(seat.player_id)
      if (!name) continue
      players.add(seat.player_id)
      const won = seat.side === game.winner_side
      if (seat.player_id === salaxeId || isSalaxe(name)) {
        salaxeSeat = { won, champion: seat.champion, lane: seat.lane }
        if (won) salaxe.wins++
        else salaxe.losses++
        if (!salaxe.champions.includes(seat.champion)) salaxe.champions.push(seat.champion)
        continue
      }
      const rec = records.get(seat.player_id) ?? { name, wins: 0, losses: 0 }
      if (won) rec.wins++
      else rec.losses++
      records.set(seat.player_id, rec)
    }
    const sessionId = sessionByGame.get(game.id) ?? null
    const vote = sessionId ? voteBySession.get(sessionId) : undefined
    const mvp = verdict(vote, "mvp")
    const inter = verdict(vote, "inter")
    mvpNames.push(...mvp)
    interNames.push(...inter)
    return {
      id: game.id,
      sessionId,
      playedAt: game.played_at,
      winner: game.winner_side,
      mvp: joinNames(mvp),
      inter: joinNames(inter),
      salaxe: salaxeSeat,
    }
  })

  const all = [...records.values()]
  const best = rank(
    all.filter((r) => r.wins >= 2 && r.wins > r.losses),
    (r) => [r.wins - r.losses, r.wins]
  )
  const worst = rank(
    all.filter((r) => r.losses >= 2 && r.losses > r.wins),
    (r) => [r.losses - r.wins, r.losses]
  )

  const settled = bets.filter((b) => b.status === "won" || b.status === "lost")
  const topWin = rank(
    settled.filter((b) => b.status === "won" && (betNet(b) ?? 0) > 0),
    (b) => [betNet(b) ?? 0]
  )
  const topLoss = rank(
    settled.filter((b) => b.status === "lost" && (betNet(b) ?? 0) < 0),
    (b) => [-(betNet(b) ?? 0)]
  )
  const allInLosers = [
    ...new Set(settled.filter((b) => b.status === "lost" && b.all_in).map((b) => userName(b.user_id)).filter((n): n is string => !!n)),
  ]

  const liveDecrees = decrees.filter((d) => d.status !== "refunded")
  const byCaster = new Map<string, { count: number; spent: number }>()
  const byType = new Map<string, number>()
  for (const d of liveDecrees) {
    const c = byCaster.get(d.user_id) ?? { count: 0, spent: 0 }
    c.count++
    c.spent += Number(d.cost) || 0
    byCaster.set(d.user_id, c)
    byType.set(d.action_type, (byType.get(d.action_type) ?? 0) + 1)
  }
  const caster = rank([...byCaster.entries()], ([, c]) => [c.count, c.spent])
  const favorite = rank([...byType.entries()], ([, c]) => [c])

  const nets = [...input.net.entries()]
  const gainer = rank(nets.filter(([, d]) => d >= TREASURY_MIN), ([, d]) => [d])
  const loser = rank(nets.filter(([, d]) => d <= -TREASURY_MIN), ([, d]) => [-d])
  const named = (entry: [string, number] | null) => {
    const name = entry ? userName(entry[0]) : null
    return entry && name ? { name, delta: entry[1] } : null
  }

  const facts: NightFacts = {
    id: input.id,
    ongoing: input.ongoing,
    games: games.length,
    blueWins: games.filter((g) => g.winner_side === "blue").length,
    redWins: games.filter((g) => g.winner_side === "red").length,
    best,
    worst,
    salaxe: salaxeId ? salaxe : null,
    biggestWin:
      topWin && userName(topWin.user_id)
        ? { name: userName(topWin.user_id)!, stake: topWin.amount, payout: topWin.payout ?? 0, profit: betNet(topWin) ?? 0, side: topWin.side }
        : null,
    biggestLoss:
      topLoss && userName(topLoss.user_id)
        ? { name: userName(topLoss.user_id)!, loss: -(betNet(topLoss) ?? 0), side: topLoss.side, insured: topLoss.insured }
        : null,
    allInLosers,
    decrees: {
      count: liveDecrees.length,
      spent: liveDecrees.reduce((sum, d) => sum + (Number(d.cost) || 0), 0),
      caster:
        caster && userName(caster[0])
          ? {
              name: userName(caster[0])!,
              count: caster[1].count,
              tied: [...byCaster.values()].filter((c) => c.count === caster[1].count).length > 1,
            }
          : null,
      favorite: favorite ? decreeName(favorite[0]) : null,
    },
    tribunal: votes === null ? null : { mvp: topCount(mvpNames), inter: topCount(interNames) },
    treasury: { gainer: named(gainer), loser: named(loser) },
  }
  return { facts, games: chronicleGames, players: players.size }
}
