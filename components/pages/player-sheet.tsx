"use client"

import { useState } from "react"
import Link from "next/link"
import { HistoryIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { PlayerRecord } from "@/components/pages/player-record"
import { PageApiError, usePlayerDetail } from "@/components/pages/queries"
import { PageError } from "@/components/pages/states"
import { PlayerTitles } from "@/components/titles/player-titles"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlayerRef } from "@/lib/pages/types"

interface PlayerSheetProps {
  player: PlayerRef | null
  onClose: () => void
}

// A public court file: any player's record, lanes, champions and rivals, opened from any list.
export function PlayerSheet({ player: requested, onClose }: PlayerSheetProps) {
  // The last opened file stays on screen while the sheet animates out.
  const [player, setPlayer] = useState(requested)
  if (requested && requested !== player) setPlayer(requested)
  const detail = usePlayerDetail(player?.id ?? null)
  const unknown = detail.error instanceof PageApiError && detail.error.status === 404

  return (
    <Dialog open={requested !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-0 sm:max-w-2xl">
        {player ? (
          <>
            <DialogHeader className="flex-row items-center gap-3 border-b border-[var(--color-gold)]/10 p-4 pr-12">
              <PlayerAvatar name={player.name} src={player.avatarUrl} size="md" ring="gold" />
              <div className="min-w-0">
                <DialogTitle className="truncate font-display text-xl font-semibold text-[var(--color-gold-light)]">{player.name}</DialogTitle>
                <DialogDescription className="sr-only">Record, lanes, champions and rivals of {player.name}</DialogDescription>
                <PlayerTitles playerId={player.id} userId={player.userId} className="mt-0.5" />
              </div>
            </DialogHeader>
            <div className="p-4">
              {detail.isPending ? (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-14 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : detail.data ? (
                <PlayerRecord detail={detail.data} perspective="them" />
              ) : unknown ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {player.name} has not set foot on the Rift yet. The file opens with the first game.
                </p>
              ) : (
                <PageError
                  title="This file is sealed"
                  message={detail.error?.message}
                  onRetry={() => void detail.refetch()}
                  retrying={detail.isFetching}
                  className="py-6"
                />
              )}
              <Link
                href={`/history?player=${player.id}`}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/25 px-3 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <HistoryIcon className="size-4" aria-hidden />
                Every game of {player.name}
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
