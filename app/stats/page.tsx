"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { findChampion, getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PlayerStat {
  id: string
  name: string
  wins: number
  losses: number
  games_played: number
  winRate: number
  mostPlayedChampion: string | null
  mostPlayedLane: string | null
}

type SortKey = "name" | "games_played" | "wins" | "losses" | "winRate"

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("wins")
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStats(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sorted = [...stats].sort((a, b) => {
    const mul = sortAsc ? 1 : -1
    if (sortKey === "name") return mul * a.name.localeCompare(b.name)
    return mul * ((a[sortKey] as number) - (b[sortKey] as number))
  })

  const mostWins = stats.length > 0
    ? stats.reduce((a, b) => (a.wins > b.wins ? a : b))
    : null

  const bestWinRate = stats.filter((s) => s.games_played >= 5).length > 0
    ? stats
        .filter((s) => s.games_played >= 5)
        .reduce((a, b) => (a.winRate > b.winRate ? a : b))
    : null

  const mostGames = stats.length > 0
    ? stats.reduce((a, b) =>
        a.games_played > b.games_played ? a : b
      )
    : null

  const SortHeader = ({
    label,
    field,
    className,
  }: {
    label: string
    field: SortKey
    className?: string
  }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-[var(--color-gold)]", className)}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field && (
        <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
      )}
    </TableHead>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--color-gold-light)]/40">
        No games played yet. Go play some games!
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              Most Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[var(--color-gold-light)]">
              {mostWins?.name ?? "-"}
            </p>
            <p className="text-sm text-[var(--color-gold-light)]/50">
              {mostWins?.wins ?? 0} wins
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              Best Win Rate (min 5 games)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[var(--color-gold-light)]">
              {bestWinRate?.name ?? "-"}
            </p>
            <p className="text-sm text-[var(--color-gold-light)]/50">
              {bestWinRate ? `${bestWinRate.winRate}%` : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              Most Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[var(--color-gold-light)]">
              {mostGames?.name ?? "-"}
            </p>
            <p className="text-sm text-[var(--color-gold-light)]/50">
              {mostGames?.games_played ?? 0} games
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-gold)]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-gold)]/10 hover:bg-transparent">
              <SortHeader label="Player" field="name" />
              <SortHeader label="Games" field="games_played" className="text-center" />
              <SortHeader label="Wins" field="wins" className="text-center" />
              <SortHeader label="Losses" field="losses" className="text-center" />
              <SortHeader label="Win Rate" field="winRate" className="text-center" />
              <TableHead>Champion</TableHead>
              <TableHead>Lane</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((player) => {
              const champ = player.mostPlayedChampion
                ? findChampion(player.mostPlayedChampion)
                : null
              return (
                <TableRow
                  key={player.id}
                  className="border-[var(--color-gold)]/10"
                >
                  <TableCell className="font-medium text-[var(--color-gold-light)]">
                    {player.name}
                  </TableCell>
                  <TableCell className="text-center">
                    {player.games_played}
                  </TableCell>
                  <TableCell className="text-center text-green-400">
                    {player.wins}
                  </TableCell>
                  <TableCell className="text-center text-red-400">
                    {player.losses}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--color-navy)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            player.winRate >= 50
                              ? "bg-green-500"
                              : "bg-red-500"
                          )}
                          style={{ width: `${Math.min(player.winRate, 100)}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-sm",
                          player.winRate >= 50
                            ? "text-green-400"
                            : "text-red-400"
                        )}
                      >
                        {player.winRate}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {champ && (
                      <div className="flex items-center gap-1.5">
                        <Image
                          src={getChampionImageUrl(champ.internal)}
                          alt={champ.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                          unoptimized
                        />
                        <span className="text-xs text-[var(--color-gold-light)]/70">
                          {champ.name}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--color-gold-light)]/70">
                    {player.mostPlayedLane
                      ? ROLE_LABELS[player.mostPlayedLane as Role] ?? player.mostPlayedLane
                      : "-"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
