import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { loadIdentities } from "@/lib/titles/server"
import type { TitlePayoutItem, TitlePayoutsResponse } from "@/lib/titles/types"

const querySchema = z.object({ sessionId: z.uuid() })

const NO_STORE = { "Cache-Control": "no-store" }

interface ApplicationRow {
  id: string
  user_id: string
  title_name: string
  kind: "perk" | "curse"
  amount: number
  beneficiary_user_id: string | null
  detail: string
}

const LEGACY_DETAIL: Record<string, { kind: TitlePayoutItem["kind"]; detail: string }> = {
  title_perk: { kind: "perk", detail: "Title perk" },
  title_curse: { kind: "curse", detail: "Paid for wearing a brand" },
  title_tribute: { kind: "tribute", detail: "Tribute from a branded subject" },
}

async function fromApplications(supabase: SupabaseClient, sessionId: string, userId: string): Promise<TitlePayoutItem[] | null> {
  const { data, error } = await supabase
    .from("title_perk_applications")
    .select("id, user_id, title_name, kind, amount, beneficiary_user_id, detail")
    .eq("session_id", sessionId)
    .or(`user_id.eq.${userId},beneficiary_user_id.eq.${userId}`)
    .neq("amount", 0)
  if (error) {
    if (isMissingSchema(error)) return null
    throw error
  }
  const rows = (data ?? []) as ApplicationRow[]
  const identities = await loadIdentities(supabase, rows.flatMap((r) => [r.user_id, r.beneficiary_user_id ?? ""]))
  const nameOf = (id: string | null) => (id ? (identities.get(id)?.name ?? null) : null)
  return rows.map((row) => {
    const asWearer = row.user_id === userId
    return {
      id: row.id,
      title: row.title_name,
      kind: asWearer ? row.kind : "tribute",
      amount: asWearer ? row.amount : -row.amount,
      detail: row.detail,
      counterpart: asWearer ? nameOf(row.beneficiary_user_id) : nameOf(row.user_id),
    }
  })
}

async function fromTransactions(supabase: SupabaseClient, sessionId: string, userId: string): Promise<TitlePayoutItem[]> {
  const { data, error } = await supabase
    .from("point_transactions")
    .select("id, amount, reason")
    .eq("user_id", userId)
    .eq("reference_id", sessionId)
    .in("reason", Object.keys(LEGACY_DETAIL))
  if (error) throw error
  return (data ?? []).map((t) => {
    const meta = LEGACY_DETAIL[t.reason as string] ?? LEGACY_DETAIL.title_perk
    return { id: t.id as string, title: null, kind: meta.kind, amount: t.amount as number, detail: meta.detail, counterpart: null }
  })
}

// What the caller's banner, brands and tributes moved in one game, for the personal result screen.
export async function GET(request: Request) {
  const parsed = querySchema.safeParse({ sessionId: new URL(request.url).searchParams.get("sessionId") ?? undefined })
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const { sessionId } = parsed.data
    const items = (await fromApplications(supabase, sessionId, user.id)) ?? (await fromTransactions(supabase, sessionId, user.id))
    const body: TitlePayoutsResponse = { items, total: items.reduce((sum, item) => sum + item.amount, 0) }
    return NextResponse.json(body, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The royal ledger is closed for a moment" }, { status: 500, headers: NO_STORE })
  }
}
