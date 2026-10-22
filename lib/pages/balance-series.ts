import type { BalancePoint, ReasonTotal } from "@/lib/pages/types"

export interface LedgerRow {
  amount: number
  reason: string
  created_at: string
}

const MAX_POINTS = 320
const BUCKETS_MS = [60_000, 3_600_000, 86_400_000]

function bucketize(rows: LedgerRow[], windowMs: number, startBalance: number): BalancePoint[] {
  const points: BalancePoint[] = []
  let running = startBalance
  let bucketStart = -Infinity
  for (const row of rows) {
    const at = Date.parse(row.created_at)
    running += row.amount
    const current = points[points.length - 1]
    if (current && at - bucketStart <= windowMs) {
      current.at = row.created_at
      current.balance = running
      current.delta += row.amount
    } else {
      bucketStart = at
      points.push({ at: row.created_at, balance: running, delta: row.amount })
    }
  }
  return points
}

// Rows must be oldest first. The curve is anchored on the known end balance, so balance resets done outside
// the ledger (a new act) never skew it: the start point absorbs them.
export function buildBalanceSeries(rows: LedgerRow[], endBalance: number, since: string): BalancePoint[] {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const startBalance = endBalance - total
  let points: BalancePoint[] = []
  for (const window of BUCKETS_MS) {
    points = bucketize(rows, window, startBalance)
    if (points.length <= MAX_POINTS) break
  }
  return [{ at: since, balance: startBalance, delta: 0 }, ...points]
}

export function summarizeReasons(rows: LedgerRow[]): { breakdown: ReasonTotal[]; income: number; spending: number } {
  const byReason = new Map<string, ReasonTotal>()
  let income = 0
  let spending = 0
  for (const row of rows) {
    if (row.amount > 0) income += row.amount
    else spending -= row.amount
    const entry = byReason.get(row.reason) ?? { reason: row.reason, count: 0, total: 0 }
    entry.count++
    entry.total += row.amount
    byReason.set(row.reason, entry)
  }
  const breakdown = [...byReason.values()].sort((x, y) => Math.abs(y.total) - Math.abs(x.total))
  return { breakdown, income, spending }
}
