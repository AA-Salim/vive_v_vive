import { createClient } from "@/lib/supabase"
import { buildBalanceSeries, summarizeReasons, type LedgerRow } from "@/lib/pages/balance-series"
import { fetchAllRows } from "@/lib/pages/fetch-all"
import { json, scribeError } from "@/lib/pages/server"
import type { ActRef, PointsHistoryResponse } from "@/lib/pages/types"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return scribeError("Sign in to open your ledger.", 401)

  try {
    const [{ data: act }, balances] = await Promise.all([
      supabase.from("acts").select("id, act_number, name, subtitle, started_at, initial_grant").eq("status", "active").maybeSingle(),
      fetchAllRows<{ user_id: string; balance: number }>((from, to) =>
        supabase.from("point_balances").select("user_id, balance").order("user_id").range(from, to)
      ),
    ])

    const since = (act?.started_at as string | undefined) ?? null
    const rows = await fetchAllRows<LedgerRow>((from, to) => {
      let query = supabase.from("point_transactions").select("amount, reason, created_at").eq("user_id", user.id)
      if (since) query = query.gte("created_at", since)
      return query.order("created_at", { ascending: true }).order("id").range(from, to)
    })

    const balance = balances.find((b) => b.user_id === user.id)?.balance ?? 0
    const start = since ?? rows[0]?.created_at ?? new Date().toISOString()
    const { breakdown, income, spending } = summarizeReasons(rows)
    const actRef: ActRef | null = act
      ? {
          id: act.id,
          number: act.act_number,
          name: act.name,
          subtitle: act.subtitle ?? null,
          startedAt: act.started_at,
          initialGrant: act.initial_grant ?? null,
        }
      : null

    const body: PointsHistoryResponse = {
      balance,
      act: actRef,
      since: start,
      series: buildBalanceSeries(rows, balance, start),
      income,
      spending,
      transactions: rows.length,
      breakdown,
      rank: balances.some((b) => b.user_id === user.id) ? balances.filter((b) => b.balance > balance).length + 1 : null,
      of: balances.length,
    }
    return json(body)
  } catch {
    return scribeError("Your ledger is stuck in the royal archives. Try again in a moment.")
  }
}
