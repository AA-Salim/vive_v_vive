"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  const mostGames = data.rivalries.reduce((best, r) =>
    r.total_games > best.total_games ? r : best
  )

  const mostOneSided = data.rivalries
    .filter((r) => r.total_games >= 3)
    .reduce<Rivalry | null>((best, r) => {
      const diff = Math.abs(r.a_wins - r.b_wins)
      const bestDiff = best ? Math.abs(best.a_wins - best.b_wins) : -1
      return diff > bestDiff ? r : best
    }, null)

  const pairLabel = (r: Rivalry) => {
    const a = nameMap.get(r.player_a) ?? "?"
    const b = nameMap.get(r.player_b) ?? "?"
    return `${a} vs ${b}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-[var(--color-gold)]">Rivalries</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              Most Games Together
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {pairLabel(mostGames)}
            </p>
            <p className="text-sm text-[var(--color-gold-light)]/50">
              {mostGames.total_games} games ({mostGames.a_wins}W-{mostGames.b_wins}L)
            </p>
          </CardContent>
        </Card>

        {mostOneSided && (
          <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--color-gold)]/70">
                Most One-Sided (min 3 games)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const dominant = mostOneSided.a_wins >= mostOneSided.b_wins
                  ? nameMap.get(mostOneSided.player_a) ?? "?"
                  : nameMap.get(mostOneSided.player_b) ?? "?"
                const dominated = mostOneSided.a_wins >= mostOneSided.b_wins
                  ? nameMap.get(mostOneSided.player_b) ?? "?"
                  : nameMap.get(mostOneSided.player_a) ?? "?"
                const wins = Math.max(mostOneSided.a_wins, mostOneSided.b_wins)
                const losses = Math.min(mostOneSided.a_wins, mostOneSided.b_wins)
                return (
                  <>
                    <p className="text-lg font-bold text-[var(--color-gold-light)]">
                      {dominant} vs {dominated}
                    </p>
                    <p className="text-sm text-[var(--color-gold-light)]/50">
                      {wins}-{losses} ({mostOneSided.total_games} games)
                    </p>
                  </>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {archNemesis.lane_duels > 0 && (
          <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--color-gold)]/70">
                Most Lane Duels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-[var(--color-gold-light)]">
                {pairLabel(archNemesis)}
              </p>
              <p className="text-sm text-[var(--color-gold-light)]/50">
                {archNemesis.lane_duels} duels ({archNemesis.a_lane_wins}-{archNemesis.b_lane_wins})
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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
