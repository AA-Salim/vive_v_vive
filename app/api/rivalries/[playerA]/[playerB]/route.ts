import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { json, loadMatchContext, scribeError } from "@/lib/pages/server"
import type { MatchupGame, RivalryDetailResponse } from "@/lib/pages/types"

const Params = z
  .object({ playerA: z.guid(), playerB: z.guid() })
  .refine((p) => p.playerA !== p.playerB, { message: "A rivalry needs two people" })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playerA: string; playerB: string }> }
) {
  const parsed = Params.safeParse(await params)
  if (!parsed.success) return scribeError("Pick two different players.", 400)
  const { playerA, playerB } = parsed.data

  const supabase = await createClient()
  try {
    const { data, internalOf } = await loadMatchContext(supabase)
    const a = data.players.get(playerA)
    const b = data.players.get(playerB)
    if (!a || !b) return scribeError("One of them is not in the royal register.", 404)

    const versus: MatchupGame[] = []
    const allied: MatchupGame[] = []
    const together = { games: 0, wins: 0 }
    for (let i = data.matches.length - 1; i >= 0; i--) {
      const match = data.matches[i]
      const seatA = match.seats.find((s) => s.playerId === playerA)
      const seatB = match.seats.find((s) => s.playerId === playerB)
      if (!seatA || !seatB) continue
      const game: MatchupGame = {
        gameId: match.id,
        playedAt: match.playedAt,
        winner: match.winner,
        a: { side: seatA.side, lane: seatA.lane, champion: seatA.champion, internal: internalOf(seatA.champion) },
        b: { side: seatB.side, lane: seatB.lane, champion: seatB.champion, internal: internalOf(seatB.champion) },
        laneDuel: seatA.side !== seatB.side && seatA.lane === seatB.lane,
      }
      if (seatA.side === seatB.side) {
        together.games++
        if (seatA.side === match.winner) together.wins++
        allied.push(game)
      } else {
        versus.push(game)
      }
    }

    const body: RivalryDetailResponse = { a, b, versus, together, allied }
    return json(body)
  } catch {
    return scribeError()
  }
}
