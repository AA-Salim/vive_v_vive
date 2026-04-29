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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface BetEntry {
  id: string
  side: "blue" | "red"
  amount: number
  payout: number | null
  status: "won" | "lost" | "refunded"
  created_at: string
  discord_username: string
  discord_avatar_url: string | null
  player_name: string | null
  session_status: string | null
  session_date: string | null
}

interface GambaStats {
  chosen: { name: string; profit: number } | null
  fool: { name: string; loss: number } | null
  degenerate: { name: string; count: number } | null
  highRoller: { name: string; amount: number; won: boolean } | null
  luckyDog: { name: string; rate: number; wins: number; total: number } | null
}

function computeStats(bets: BetEntry[]): GambaStats {
  const byUser = new Map<string, { name: string; profit: number; count: number; wins: number }>()

  for (const b of bets) {
    if (b.status === "refunded") continue
    const name = b.player_name ?? b.discord_username
    const existing = byUser.get(name) ?? { name, profit: 0, count: 0, wins: 0 }
    existing.count++
    if (b.status === "won" && b.payout !== null) {
      existing.profit += b.payout - b.amount
      existing.wins++
    } else if (b.status === "lost") {
      existing.profit -= b.amount
    }
    byUser.set(name, existing)
  }

  const users = Array.from(byUser.values())

  const chosen = users.length > 0
    ? users.reduce((a, b) => (a.profit > b.profit ? a : b))
    : null

  const fool = users.length > 0
    ? users.reduce((a, b) => (a.profit < b.profit ? a : b))
    : null

  const degenerate = users.length > 0
    ? users.reduce((a, b) => (a.count > b.count ? a : b))
    : null

  const resolvedBets = bets.filter((b) => b.status === "won" || b.status === "lost")
  const highRoller = resolvedBets.length > 0
    ? (() => {
        const b = resolvedBets.reduce((a, c) => (c.amount > a.amount ? c : a))
        return { name: b.player_name ?? b.discord_username, amount: b.amount, won: b.status === "won" }
      })()
    : null

  const eligible = users.filter((u) => u.count >= 3)
  const luckyDog = eligible.length > 0
    ? (() => {
        const best = eligible.reduce((a, b) =>
          a.wins / a.count > b.wins / b.count ? a : b
        )
        return {
          name: best.name,
          rate: Math.round((best.wins / best.count) * 100),
          wins: best.wins,
          total: best.count,
        }
      })()
    : null

  return {
    chosen: chosen && chosen.profit > 0 ? chosen : null,
    fool: fool && fool.profit < 0 ? { name: fool.name, loss: Math.abs(fool.profit) } : null,
    degenerate,
    highRoller,
    luckyDog,
  }
}

export default function GambaPage() {
  const [bets, setBets] = useState<BetEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bets")
      .then((r) => r.json())
      .then((data) => {
        if (data.bets) setBets(data.bets)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  if (bets.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--color-gold-light)]/40">
        No bets placed yet. Start gambling!
      </div>
    )
  }

  const stats = computeStats(bets)

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold tracking-wider text-[var(--color-gold)]">
        GAMBA
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              Chalaksse's Chosen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {stats.chosen?.name ?? "-"}
            </p>
            <p className="text-sm text-green-400">
              {stats.chosen ? `+${stats.chosen.profit} profit` : "No winners yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              The Royal Fool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {stats.fool?.name ?? "-"}
            </p>
            <p className="text-sm text-[var(--color-red-team)]">
              {stats.fool ? `-${stats.fool.loss} in the gutter` : "No losers yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              The Degenerate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {stats.degenerate?.name ?? "-"}
            </p>
            <p className="text-sm text-[var(--color-gold-light)]/50">
              {stats.degenerate ? `${stats.degenerate.count} bets placed` : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              The High Roller
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {stats.highRoller?.name ?? "-"}
            </p>
            <p className={cn("text-sm", stats.highRoller?.won ? "text-green-400" : "text-[var(--color-red-team)]")}>
              {stats.highRoller
                ? `${stats.highRoller.amount} pts (${stats.highRoller.won ? "Won" : "Lost"})`
                : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold)]/70">
              The Lucky Dog (min 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-[var(--color-gold-light)]">
              {stats.luckyDog?.name ?? "-"}
            </p>
            <p className="text-sm text-green-400">
              {stats.luckyDog
                ? `${stats.luckyDog.rate}% (${stats.luckyDog.wins}/${stats.luckyDog.total})`
                : "Need 3+ bets"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-gold)]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-gold)]/10 hover:bg-transparent">
              <TableHead className="text-[var(--color-gold-light)]/60">Date</TableHead>
              <TableHead className="text-[var(--color-gold-light)]/60">Player</TableHead>
              <TableHead className="text-center text-[var(--color-gold-light)]/60">Side</TableHead>
              <TableHead className="text-right text-[var(--color-gold-light)]/60">Bet</TableHead>
              <TableHead className="text-right text-[var(--color-gold-light)]/60">Payout</TableHead>
              <TableHead className="text-center text-[var(--color-gold-light)]/60">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets.map((bet) => {
              const date = new Date(bet.created_at)
              const profit = bet.status === "won" && bet.payout !== null
                ? bet.payout - bet.amount
                : null
              return (
                <TableRow key={bet.id} className="border-[var(--color-gold)]/10">
                  <TableCell className="text-sm text-[var(--color-gold-light)]/70">
                    {date.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[var(--color-navy)]">
                        {bet.discord_avatar_url ? (
                          <Image
                            src={bet.discord_avatar_url}
                            alt={bet.discord_username}
                            width={24}
                            height={24}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-[var(--color-gold)]">
                            {bet.discord_username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-[var(--color-gold-light)]">
                        {bet.player_name ?? bet.discord_username}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={cn(
                        "text-xs font-bold",
                        bet.side === "blue"
                          ? "bg-[var(--color-blue-team)]/20 text-[var(--color-blue-team)]"
                          : "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
                      )}
                    >
                      {bet.side === "blue" ? "Blue" : "Red"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-[var(--color-gold-light)]">
                    {bet.amount}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {bet.status === "won" && bet.payout !== null ? (
                      <span className="text-green-400">
                        {bet.payout} (+{profit})
                      </span>
                    ) : bet.status === "lost" ? (
                      <span className="text-[var(--color-red-team)]">0</span>
                    ) : (
                      <span className="text-[var(--color-gold-light)]/40">
                        {bet.amount}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={cn(
                        "text-xs",
                        bet.status === "won"
                          ? "bg-green-500/20 text-green-400"
                          : bet.status === "lost"
                            ? "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
                            : "bg-gray-500/20 text-gray-400"
                      )}
                    >
                      {bet.status === "won" ? "Won" : bet.status === "lost" ? "Lost" : "Refunded"}
                    </Badge>
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
