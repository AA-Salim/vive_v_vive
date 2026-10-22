import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { buildChampionIndex } from "@/lib/pages/champion-index"
import { decodeCursor, encodeCursor, loadHistoryPage, loadSessionExtras, loadVerdicts, toHistoryGame } from "@/lib/pages/history"
import { loadPlayers } from "@/lib/pages/matches"
import { resolveSeason, SeasonParam } from "@/lib/pages/season"
import { json, loadPools, scribeError } from "@/lib/pages/server"
import type { HistoryGame, HistoryResponse } from "@/lib/pages/types"

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
  player: z.guid().optional(),
  act: SeasonParam,
})

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = Query.safeParse(params)
  if (!parsed.success) return scribeError("That page of the chronicle does not exist.", 400)
  const { limit, cursor: rawCursor, player, act } = parsed.data
  const cursor = decodeCursor(rawCursor)
  if (rawCursor && !cursor) return scribeError("That page of the chronicle does not exist.", 400)

  const supabase = await createClient()
  try {
    const scope = await resolveSeason(supabase, act)
    if ("error" in scope) return scope.error
    const [page, players, pools] = await Promise.all([
      loadHistoryPage(supabase, { limit, cursor, playerId: player ?? null, window: scope.window }),
      loadPlayers(supabase),
      loadPools(),
    ])
    const ids = page.rows.map((r) => r.id)
    const [extras, verdicts] = await Promise.all([loadSessionExtras(supabase, ids), loadVerdicts(supabase, ids)])
    const internalOf = buildChampionIndex(pools)
    const games = page.rows
      .map((row) => toHistoryGame(row, players, internalOf, extras.get(row.id), verdicts.get(row.id)))
      .filter((g): g is HistoryGame => g !== null)
    const body: HistoryResponse = { games, nextCursor: page.next ? encodeCursor(page.next) : null, season: scope.season }
    return json(body)
  } catch {
    return scribeError()
  }
}
