import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { badRequest, rpcError, unauthorized } from "@/lib/bounties/errors"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import { shameStats } from "@/lib/bounties/shame-stats"
import { loadPlayedGames, loadPreview, loadWall, recentLossRows } from "@/lib/bounties/server/pillory"
import type { PilloryPostResult, EggResult } from "@/lib/bounties/types"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  const supabase = await createClient()
  const target = new URL(request.url).searchParams.get("target")
  try {
    if (target) {
      if (!z.uuid().safeParse(target).success) return badRequest("Unknown player.")
      const preview = await loadPreview(supabase, target)
      if (!preview) return NextResponse.json({ error: "That player is not on the roster." }, { status: 404 })
      return NextResponse.json(preview, { headers: NO_STORE })
    }
    return NextResponse.json(await loadWall(supabase), { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The pillory collapsed under the weight of the shame." }, { status: 500 })
  }
}

const STAT_KEYS = ["streak", "week", "champion", "lane", "hiding", "last", "career", "ghost", "clean"] as const

const postSchema = z.object({
  action: z.literal("post"),
  targetPlayerId: z.uuid(),
  message: z.string().trim().min(1).max(PILLORY_RULES.messageMax),
  statKey: z.enum(STAT_KEYS).nullish(),
})

const eggSchema = z.object({ action: z.literal("egg"), entryId: z.uuid() })

// The pre-pillory client sent { target_player_id, message } with no action.
const bodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw
    const body = raw as Record<string, unknown>
    if (body.action === "egg") return body
    return { ...body, action: "post", targetPlayerId: body.targetPlayerId ?? body.target_player_id }
  },
  z.discriminatedUnion("action", [postSchema, eggSchema])
)

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(`Pick a target and a roast (${PILLORY_RULES.messageMax} characters at most).`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorized("Sign in with Discord to use the pillory.")

  const body = parsed.data
  if (body.action === "egg") {
    const { data, error } = await supabase.rpc("pillory_throw_egg", { p_entry_id: body.entryId })
    if (error) {
      if (isMissingSchema(error)) return migrationPending("Eggs")
      return rpcError(error, "The egg missed. Try again.")
    }
    const rpc = data as {
      entry_id: string
      eggs: number
      expires_at: string
      extended: boolean
      target_name?: string | null
      target_user_id?: string | null
    }
    emitLive("shame.egged", {
      actor: await getActor(supabase, user.id),
      data: { targetName: rpc.target_name ?? "Someone", eggs: rpc.eggs, extended: rpc.extended, targetUserId: rpc.target_user_id ?? null },
      persist: false,
    })
    const result: EggResult = { entryId: rpc.entry_id, eggs: rpc.eggs, expiresAt: rpc.expires_at, extended: rpc.extended }
    return NextResponse.json(result)
  }

  let games
  try {
    games = await loadPlayedGames(supabase, body.targetPlayerId)
  } catch {
    return NextResponse.json({ error: "The scribes could not read their record. Try again." }, { status: 500 })
  }
  const stats = shameStats(games, Date.now())
  const stat = stats.find((s) => s.key === body.statKey) ?? stats[0]

  const { data, error } = await supabase.rpc("pillory_post", {
    p_target_player_id: body.targetPlayerId,
    p_message: body.message,
    p_stat_label: stat.label,
    p_stat_value: stat.value,
    p_recent_losses: recentLossRows(games),
    p_details: { stat: stat.key },
  })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("The Pillory")
    return rpcError(error, "The nails bent. Nobody was pilloried, your points are safe.")
  }

  const rpc = data as { entry: { id: string; expires_at: string }; target_name: string; target_user_id: string | null; balance: number }
  emitLive("shame.posted", {
    actor: await getActor(supabase, user.id),
    data: {
      targetName: rpc.target_name,
      message: body.message,
      targetUserId: rpc.target_user_id,
      source: "user",
      stat: `${stat.label}: ${stat.value}`,
    },
  })

  const result: PilloryPostResult = {
    entryId: rpc.entry.id,
    balance: typeof rpc.balance === "number" ? rpc.balance : null,
    targetName: rpc.target_name,
    expiresAt: rpc.entry.expires_at,
  }
  return NextResponse.json(result, { status: 201 })
}
