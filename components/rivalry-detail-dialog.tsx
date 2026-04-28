"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { findChampion, getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import type { Role, Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MatchupGame {
  game_id: string
  played_at: string
  winner_side: Side
  a_side: Side
  a_lane: string
  a_champion: string
  b_side: Side
  b_lane: string
  b_champion: string
}

interface RivalryDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerAId: string | null
  playerBId: string | null
  playerAName: string
  playerBName: string
}

export function RivalryDetailDialog({
  open,
  onOpenChange,
  playerAId,
  playerBId,
  playerAName,
  playerBName,
}: RivalryDetailDialogProps) {
  const [games, setGames] = useState<MatchupGame[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !playerAId || !playerBId) return

    setLoading(true)
    fetch(`/api/rivalries/${playerAId}/${playerBId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.games) setGames(data.games)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, playerAId, playerBId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-[var(--color-gold)]/20 bg-[var(--color-navy)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--color-gold)]">
            {playerAName} vs {playerBName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-gold-light)]/40">
            No opposing matchups found.
          </p>
        ) : (
          <div className="space-y-3">
            {games.map((game) => {
              const date = new Date(game.played_at)
              const aWon = game.winner_side === game.a_side
              const isLaneDuel = game.a_lane === game.b_lane
              const champA = findChampion(game.a_champion)
              const champB = findChampion(game.b_champion)

              return (
                <div
                  key={game.game_id}
                  className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-[var(--color-gold-light)]/50">
                      {date.toLocaleDateString()}
                    </span>
                    {isLaneDuel && (
                      <Badge className="bg-[var(--color-gold)]/10 text-[var(--color-gold)] text-[10px]">
                        Lane Duel
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className={cn(
                      "flex items-center gap-2",
                      aWon ? "opacity-100" : "opacity-50"
                    )}>
                      {champA && (
                        <Image
                          src={getChampionImageUrl(champA.internal)}
                          alt={game.a_champion}
                          width={32}
                          height={32}
                          className="rounded-full"
                          unoptimized
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-gold-light)]">
                          {playerAName}
                        </p>
                        <p className="text-[10px] text-[var(--color-gold-light)]/50">
                          {ROLE_LABELS[game.a_lane as Role] ?? game.a_lane} / {game.a_side}
                        </p>
                      </div>
                      {aWon && <span className="text-xs text-green-400">W</span>}
                    </div>

                    <span className="text-xs font-bold text-[var(--color-gold)]/40">vs</span>

                    <div className={cn(
                      "flex items-center justify-end gap-2",
                      !aWon ? "opacity-100" : "opacity-50"
                    )}>
                      {!aWon && <span className="text-xs text-green-400">W</span>}
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm font-medium text-[var(--color-gold-light)]">
                          {playerBName}
                        </p>
                        <p className="text-[10px] text-[var(--color-gold-light)]/50">
                          {ROLE_LABELS[game.b_lane as Role] ?? game.b_lane} / {game.b_side}
                        </p>
                      </div>
                      {champB && (
                        <Image
                          src={getChampionImageUrl(champB.internal)}
                          alt={game.b_champion}
                          width={32}
                          height={32}
                          className="rounded-full"
                          unoptimized
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
