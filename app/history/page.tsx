"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { findChampion, getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import { LaneIcon } from "@/components/lane-icon"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GamePlayerData {
  id: string
  side: string
  lane: string
  champion: string
  players: { id: string; name: string }
}

interface GameData {
  id: string
  played_at: string
  winner_side: string
  game_players: GamePlayerData[]
}

const LANE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"]

export default function HistoryPage() {
  const [games, setGames] = useState<GameData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGames(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--color-gold-light)]/40">
        No games played yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-[var(--color-gold)]">
        Match History
      </h1>
      {games.map((game) => {
        const date = new Date(game.played_at)
        const bluePlayers = game.game_players
          .filter((gp) => gp.side === "blue")
          .sort(
            (a, b) =>
              LANE_ORDER.indexOf(a.lane as Role) -
              LANE_ORDER.indexOf(b.lane as Role)
          )
        const redPlayers = game.game_players
          .filter((gp) => gp.side === "red")
          .sort(
            (a, b) =>
              LANE_ORDER.indexOf(a.lane as Role) -
              LANE_ORDER.indexOf(b.lane as Role)
          )

        return (
          <Collapsible key={game.id}>
            <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-navy-lighter)]">
              <span className="text-sm text-[var(--color-gold-light)]/60">
                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Badge
                className={cn(
                  "text-xs font-bold",
                  game.winner_side === "blue"
                    ? "bg-[var(--color-blue-team)]/20 text-[var(--color-blue-team)]"
                    : "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
                )}
              >
                {game.winner_side === "blue" ? "Blue Win" : "Red Win"}
              </Badge>
              <span className="flex-1" />
              <span className="text-xs text-[var(--color-gold-light)]/30">
                ▼
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 grid grid-cols-2 gap-4 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
                <div>
                  <h4
                    className={cn(
                      "mb-2 text-xs font-bold uppercase tracking-wider",
                      game.winner_side === "blue"
                        ? "text-[var(--color-blue-team)]"
                        : "text-[var(--color-blue-team)]/60"
                    )}
                  >
                    Blue Side
                    {game.winner_side === "blue" && " ★"}
                  </h4>
                  <div className="space-y-2">
                    {bluePlayers.map((gp) => {
                      const champ = findChampion(gp.champion)
                      return (
                        <div
                          key={gp.id}
                          className="flex items-center gap-2"
                        >
                          <LaneIcon
                            lane={gp.lane as Role}
                            size={14}
                            className="shrink-0 text-[var(--color-gold)]/50"
                          />
                          {champ && (
                            <Image
                              src={getChampionImageUrl(champ.internal)}
                              alt={gp.champion}
                              width={28}
                              height={28}
                              className="rounded-full"
                              unoptimized
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[var(--color-gold-light)]">
                              {gp.champion}
                            </p>
                            <p className="truncate text-[10px] text-[var(--color-gold-light)]/50">
                              {gp.players?.name}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <h4
                    className={cn(
                      "mb-2 text-xs font-bold uppercase tracking-wider",
                      game.winner_side === "red"
                        ? "text-[var(--color-red-team)]"
                        : "text-[var(--color-red-team)]/60"
                    )}
                  >
                    Red Side
                    {game.winner_side === "red" && " ★"}
                  </h4>
                  <div className="space-y-2">
                    {redPlayers.map((gp) => {
                      const champ = findChampion(gp.champion)
                      return (
                        <div
                          key={gp.id}
                          className="flex items-center gap-2"
                        >
                          <LaneIcon
                            lane={gp.lane as Role}
                            size={14}
                            className="shrink-0 text-[var(--color-gold)]/50"
                          />
                          {champ && (
                            <Image
                              src={getChampionImageUrl(champ.internal)}
                              alt={gp.champion}
                              width={28}
                              height={28}
                              className="rounded-full"
                              unoptimized
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[var(--color-gold-light)]">
                              {gp.champion}
                            </p>
                            <p className="truncate text-[10px] text-[var(--color-gold-light)]/50">
                              {gp.players?.name}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
