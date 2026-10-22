import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { buildChampionIndex } from "@/lib/pages/champion-index"
import { GAME_COLUMNS, loadSessionExtras, loadVerdicts, toHistoryGame, type GameRow } from "@/lib/pages/history"
import { loadPlayers } from "@/lib/pages/matches"
import { loadSeasons, seasonOfGame } from "@/lib/pages/season"
import { json, loadPools, scribeError } from "@/lib/pages/server"
import type { GameDetailResponse } from "@/lib/pages/types"

const Params = z.object({ id: z.guid() })

// Games removed by the duplicate cleanup answer 404 like any other missing game: links to them stay harmless.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await params)
  if (!parsed.success) return scribeError("That is not a game the chronicle knows.", 400)

  const supabase = await createClient()
  try {
    const [gameResult, players, pools, seasons] = await Promise.all([
      supabase.from("games").select(GAME_COLUMNS).eq("id", parsed.data.id).maybeSingle(),
      loadPlayers(supabase),
      loadPools(),
      loadSeasons(supabase),
    ])
    if (gameResult.error) return scribeError()
    const row = gameResult.data as unknown as GameRow | null
    if (!row) return scribeError("This game is no longer in the chronicle.", 404)

    const [extras, verdicts] = await Promise.all([loadSessionExtras(supabase, [row.id]), loadVerdicts(supabase, [row.id])])
    const game = toHistoryGame(row, players, buildChampionIndex(pools), extras.get(row.id), verdicts.get(row.id))
    if (!game) return scribeError("This game is no longer in the chronicle.", 404)

    const body: GameDetailResponse = { game, season: seasonOfGame(seasons, game.playedAt) }
    return json(body)
  } catch {
    return scribeError()
  }
}
