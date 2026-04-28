"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ArchNemesisCard } from "@/components/arch-nemesis-card"
import { RivalryMatrix } from "@/components/rivalry-matrix"

interface PlayerInfo {
  id: string
  name: string
}

interface Rivalry {
  player_a: string
  player_b: string
  total_games: number
  a_wins: number
  b_wins: number
  lane_duels: number
  a_lane_wins: number
  b_lane_wins: number
}

interface RivalryData {
  players: PlayerInfo[]
  rivalries: Rivalry[]
}

export default function RivalriesPage() {
  const [data, setData] = useState<RivalryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/rivalries")
      .then((r) => r.json())
      .then((json) => {
        if (json.players && json.rivalries) setData(json)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="mx-auto h-32 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.rivalries.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--color-gold-light)]/40">
        No rivalry data yet. Play some games on opposite sides!
      </div>
    )
  }

  const archNemesis = data.rivalries.reduce((best, r) =>
    r.lane_duels > best.lane_duels ? r : best
  )

  const nameMap = new Map(data.players.map((p) => [p.id, p.name]))

  const activePlayers = data.players.filter((p) =>
    data.rivalries.some((r) => r.player_a === p.id || r.player_b === p.id)
  )

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-[var(--color-gold)]">Rivalries</h1>

      {archNemesis.lane_duels > 0 && (
        <div className="mx-auto max-w-xl">
          <ArchNemesisCard
            playerAName={nameMap.get(archNemesis.player_a) ?? "Unknown"}
            playerBName={nameMap.get(archNemesis.player_b) ?? "Unknown"}
            laneDuels={archNemesis.lane_duels}
            aLaneWins={archNemesis.a_lane_wins}
            bLaneWins={archNemesis.b_lane_wins}
          />
        </div>
      )}

      <RivalryMatrix players={activePlayers} rivalries={data.rivalries} />
    </div>
  )
}
