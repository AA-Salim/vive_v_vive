import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

interface GamePlayerRow {
  game_id: string
  player_id: string
  side: string
  games: { winner_side: string }
}

interface DuoAgg {
  games_together: number
  wins_together: number
  losses_together: number
}

interface PlayerRecord {
  id: string
  name: string
  wins: number
  losses: number
}

type DuoLabel = "ON HIS KNEES" | "DADDY" | "RIDE OR DIE"

interface BonusLabel {
  label: string
  text: string
}

export async function GET() {
  const supabase = await createClient()

  const [gpResult, playersResult] = await Promise.all([
    supabase
      .from("game_players")
      .select("game_id, player_id, side, games!inner(winner_side)"),
    supabase.from("players").select("id, name, wins, losses"),
  ])

  if (gpResult.error) {
    return NextResponse.json({ error: gpResult.error.message }, { status: 500 })
  }
  if (playersResult.error) {
    return NextResponse.json(
      { error: playersResult.error.message },
      { status: 500 }
    )
  }

  const gamePlayers = gpResult.data as unknown as GamePlayerRow[]
  const players = playersResult.data as PlayerRecord[]
  const playerMap = new Map(players.map((p) => [p.id, p]))

  const byGame = new Map<string, GamePlayerRow[]>()
  for (const gp of gamePlayers) {
    const list = byGame.get(gp.game_id) ?? []
    list.push(gp)
    byGame.set(gp.game_id, list)
  }

  const duoMap = new Map<string, DuoAgg>()
  const playerGamesWithout = new Map<string, Map<string, { wins: number; total: number }>>()

  for (const [, entries] of byGame) {
    const bySide = new Map<string, GamePlayerRow[]>()
    for (const gp of entries) {
      const list = bySide.get(gp.side) ?? []
      list.push(gp)
      bySide.set(gp.side, list)
    }

    for (const [side, sideEntries] of bySide) {
      const winnerSide = sideEntries[0].games.winner_side
      const won = side === winnerSide

      for (let i = 0; i < sideEntries.length; i++) {
        const teammates = new Set<string>()
        for (let j = 0; j < sideEntries.length; j++) {
          if (i !== j) teammates.add(sideEntries[j].player_id)
        }

        for (let j = i + 1; j < sideEntries.length; j++) {
          const a = sideEntries[i].player_id
          const b = sideEntries[j].player_id
          const key = a < b ? `${a}|${b}` : `${b}|${a}`

          const agg = duoMap.get(key) ?? {
            games_together: 0,
            wins_together: 0,
            losses_together: 0,
          }
          agg.games_together++
          if (won) agg.wins_together++
          else agg.losses_together++
          duoMap.set(key, agg)
        }

        const pid = sideEntries[i].player_id
        if (!playerGamesWithout.has(pid)) {
          playerGamesWithout.set(pid, new Map())
        }
        const pMap = playerGamesWithout.get(pid)!
        for (const teammate of teammates) {
          const rec = pMap.get(teammate) ?? { wins: 0, total: 0 }
          rec.total++
          if (won) rec.wins++
          pMap.set(teammate, rec)
        }
      }
    }
  }

  const duos: {
    player_a: string
    player_a_name: string
    player_b: string
    player_b_name: string
    games_together: number
    wins_together: number
    losses_together: number
    win_rate: number
    label: string | null
    label_text: string | null
    stronger: string | null
    weaker: string | null
    bonus_labels: BonusLabel[]
  }[] = []

  for (const [key, agg] of duoMap) {
    const [aId, bId] = key.split("|")
    const playerA = playerMap.get(aId)
    const playerB = playerMap.get(bId)
    if (!playerA || !playerB) continue

    const winRate =
      agg.games_together > 0
        ? Math.round((agg.wins_together / agg.games_together) * 1000) / 10
        : 0

    const aTotal = playerA.wins + playerA.losses
    const bTotal = playerB.wins + playerB.losses
    const aWr = aTotal > 0 ? (playerA.wins / aTotal) * 100 : 0
    const bWr = bTotal > 0 ? (playerB.wins / bTotal) * 100 : 0

    const stronger = aWr >= bWr ? aId : bId
    const weaker = aWr >= bWr ? bId : aId

    duos.push({
      player_a: aId,
      player_a_name: playerA.name,
      player_b: bId,
      player_b_name: playerB.name,
      games_together: agg.games_together,
      wins_together: agg.wins_together,
      losses_together: agg.losses_together,
      win_rate: winRate,
      label: null,
      label_text: null,
      stronger,
      weaker,
      bonus_labels: [],
    })
  }

  duos.sort((a, b) => b.wins_together - a.wins_together)

  const labels: { rank: number; label: DuoLabel; format: (s: string, w: string) => string }[] = [
    { rank: 0, label: "ON HIS KNEES", format: (s, w) => `${w} is ON HIS KNEES for ${s}` },
    { rank: 1, label: "DADDY", format: (s, w) => `${s} IS ${w}'s DADDY` },
    { rank: 2, label: "RIDE OR DIE", format: (s, w) => `${w} is ${s}'s RIDE OR DIE` },
  ]

  for (const { rank, label, format } of labels) {
    if (duos[rank]) {
      const d = duos[rank]
      const strongerName = playerMap.get(d.stronger!)?.name ?? ""
      const weakerName = playerMap.get(d.weaker!)?.name ?? ""
      d.label = label
      d.label_text = format(strongerName, weakerName)
    }
  }

  let maxGamesTogether = 0
  let inseparableIdx = -1
  for (let i = 0; i < duos.length; i++) {
    if (duos[i].games_together > maxGamesTogether) {
      maxGamesTogether = duos[i].games_together
      inseparableIdx = i
    }
  }

  for (let i = 0; i < duos.length; i++) {
    const d = duos[i]
    const aTotal = playerMap.get(d.player_a)!.wins + playerMap.get(d.player_a)!.losses
    const bTotal = playerMap.get(d.player_b)!.wins + playerMap.get(d.player_b)!.losses
    const aWr = aTotal > 0 ? (playerMap.get(d.player_a)!.wins / aTotal) * 100 : 0
    const bWr = bTotal > 0 ? (playerMap.get(d.player_b)!.wins / bTotal) * 100 : 0
    const wrDiff = Math.abs(aWr - bWr)

    if (wrDiff >= 15 && d.win_rate >= 60) {
      const carry = aWr > bWr ? d.player_a_name : d.player_b_name
      d.bonus_labels.push({
        label: "THE CARRY",
        text: `${carry} is THE CARRY`,
      })
    }

    const aWithoutB = playerGamesWithout.get(d.player_a)?.get(d.player_b)
    const bWithoutA = playerGamesWithout.get(d.player_b)?.get(d.player_a)

    const aTotalGames = aTotal
    const bTotalGames = bTotal

    if (aTotalGames > 0 && aWithoutB) {
      const aGamesWithB = aWithoutB.total
      const aWinsWithB = aWithoutB.wins
      const aGamesWithoutB = aTotalGames - aGamesWithB
      const aWinsWithoutB = playerMap.get(d.player_a)!.wins - aWinsWithB
      const wrWithoutB = aGamesWithoutB > 0 ? (aWinsWithoutB / aGamesWithoutB) * 100 : 0
      const wrWithB = aGamesWithB > 0 ? (aWinsWithB / aGamesWithB) * 100 : 0

      if (wrWithoutB < 35 && wrWithB >= 55) {
        d.bonus_labels.push({
          label: "NOTHING WITHOUT HIM",
          text: `${d.player_a_name} is NOTHING WITHOUT ${d.player_b_name}`,
        })
      }
    }

    if (bTotalGames > 0 && bWithoutA) {
      const bGamesWithA = bWithoutA.total
      const bWinsWithA = bWithoutA.wins
      const bGamesWithoutA = bTotalGames - bGamesWithA
      const bWinsWithoutA = playerMap.get(d.player_b)!.wins - bWinsWithA
      const wrWithoutA = bGamesWithoutA > 0 ? (bWinsWithoutA / bGamesWithoutA) * 100 : 0
      const wrWithA = bGamesWithA > 0 ? (bWinsWithA / bGamesWithA) * 100 : 0

      if (wrWithoutA < 35 && wrWithA >= 55) {
        d.bonus_labels.push({
          label: "NOTHING WITHOUT HIM",
          text: `${d.player_b_name} is NOTHING WITHOUT ${d.player_a_name}`,
        })
      }
    }

    if (i === inseparableIdx) {
      d.bonus_labels.push({
        label: "INSEPARABLE",
        text: `${d.player_a_name} & ${d.player_b_name} are INSEPARABLE`,
      })
    }
  }

  return NextResponse.json({ duos })
}
