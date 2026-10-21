import { betNet } from "@/lib/betting/math"
import { bettorFor } from "@/lib/betting/server/rows"
import type {
  BetRow,
  Bettor,
  HallBetRecord,
  HallOfFame,
  HallRecentBet,
  HallScope,
  HallStanding,
  RulesVersion,
} from "@/lib/betting/types"

const ORACLE_MIN_DECIDED = 5
const RECENT_LIMIT = 20

function pick<T>(items: T[], score: (item: T) => number, accept: (value: number) => boolean): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const item of items) {
    const value = score(item)
    if (!accept(value)) continue
    if (best === null || value > bestScore) {
      best = item
      bestScore = value
    }
  }
  return best
}

function record(row: BetRow, bettor: Bettor): HallBetRecord {
  return {
    user_id: row.user_id,
    name: bettor.name,
    avatar_url: bettor.discord_avatar_url,
    bet_id: row.id,
    amount: row.amount,
    net: betNet(row) ?? 0,
    side: row.side,
    status: row.status,
    at: row.created_at,
  }
}

export function buildHallOfFame(
  rows: BetRow[],
  bettors: Map<string, Bettor>,
  scope: HallScope,
  act: HallOfFame["act"],
  version: RulesVersion
): HallOfFame {
  const standings = new Map<string, HallStanding>()
  for (const row of rows) {
    const bettor = bettorFor(bettors, row.user_id)
    const s =
      standings.get(row.user_id) ??
      {
        user_id: row.user_id,
        name: bettor.name,
        avatar_url: bettor.discord_avatar_url,
        bets: 0,
        won: 0,
        lost: 0,
        refunded: 0,
        net: 0,
        volume: 0,
        best_win: 0,
        worst_loss: 0,
        insured: 0,
        recovered: 0,
        all_ins: 0,
        bonus: 0,
      }
    const net = betNet(row) ?? 0
    s.bets += 1
    s.net += net
    s.bonus += row.bonus
    if (row.insured) s.insured += 1
    if (row.all_in) s.all_ins += 1
    if (row.status === "won") {
      s.won += 1
      s.best_win = Math.max(s.best_win, net)
    } else if (row.status === "lost") {
      s.lost += 1
      s.worst_loss = Math.min(s.worst_loss, net)
      if (row.insured) s.recovered += row.payout ?? 0
    } else if (row.status === "refunded") {
      s.refunded += 1
    }
    if (row.status !== "refunded") s.volume += row.amount
    standings.set(row.user_id, s)
  }

  const table = [...standings.values()].sort((a, b) => b.net - a.net || b.volume - a.volume)
  const won = rows.filter((r) => r.status === "won")
  const lost = rows.filter((r) => r.status === "lost")
  const decided = won.concat(lost)

  const heist = pick(won, (r) => betNet(r) ?? 0, (v) => v > 0)
  const thrown = pick(lost, (r) => -(betNet(r) ?? 0), (v) => v > 0)
  const highRoller = pick(decided, (r) => r.amount, (v) => v > 0)
  const oracle = pick(
    table.filter((s) => s.won + s.lost >= ORACLE_MIN_DECIDED),
    (s) => s.won / (s.won + s.lost),
    () => true
  )

  const recent: HallRecentBet[] = [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_LIMIT)
    .map((row) => {
      const bettor = bettorFor(bettors, row.user_id)
      return {
        user_id: row.user_id,
        name: bettor.name,
        avatar_url: bettor.discord_avatar_url,
        bet_id: row.id,
        side: row.side,
        amount: row.amount,
        net: betNet(row) ?? 0,
        status: row.status,
        insured: row.insured,
        all_in: row.all_in,
        early: row.early_amount > 0,
        at: row.created_at,
      }
    })

  return {
    scope,
    act,
    rules_version: version,
    totals: {
      bets: rows.length,
      bettors: table.length,
      wagered: table.reduce((sum, s) => sum + s.volume, 0),
      recovered: table.reduce((sum, s) => sum + s.recovered, 0),
      bonus: table.reduce((sum, s) => sum + s.bonus, 0),
      all_ins: table.reduce((sum, s) => sum + s.all_ins, 0),
    },
    records: {
      chosen: pick(table, (s) => s.net, (v) => v > 0),
      fool: pick(table, (s) => -s.net, (v) => v > 0),
      heist: heist ? record(heist, bettorFor(bettors, heist.user_id)) : null,
      throw: thrown ? record(thrown, bettorFor(bettors, thrown.user_id)) : null,
      high_roller: highRoller ? record(highRoller, bettorFor(bettors, highRoller.user_id)) : null,
      degenerate: pick(table, (s) => s.bets, (v) => v > 0),
      oracle: oracle ? { ...oracle, win_rate: Math.round((oracle.won / (oracle.won + oracle.lost)) * 100) } : null,
      angel: pick(table, (s) => s.recovered, (v) => v > 0),
      boots: pick(table, (s) => s.all_ins, (v) => v > 0),
    },
    standings: table,
    recent,
  }
}
