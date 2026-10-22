"use client"

import { ScrollTextIcon, XIcon } from "lucide-react"
import { formatDay } from "@/components/pages/format"
import { MatchCard } from "@/components/pages/history/match-card"
import { PageError } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"
import { seasonTitle } from "@/lib/pages/season-calendar"
import type { GameDetailResponse, Season } from "@/lib/pages/types"

interface OpenedGameProps {
  detail: GameDetailResponse | undefined
  loading: boolean
  gone: boolean
  error: string | null
  retrying: boolean
  onRetry: () => void
  onClose: () => void
  // The act the list below is showing, to say when the opened game comes from another one.
  listed: Season | null | undefined
  highlight: string | null
}

// A game opened from a link (/history?game=<id>) that is not on the loaded pages of the list.
export function OpenedGame({ detail, loading, gone, error, retrying, onRetry, onClose, listed, highlight }: OpenedGameProps) {
  const other = detail !== undefined && listed !== undefined && (listed === null || detail.season?.number !== listed.number)
  return (
    <section id="opened-game" aria-labelledby="opened-game-title" className="scroll-mt-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-gold)]/10 pb-1.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)] uppercase">The game you opened</p>
          <h2 id="opened-game-title" className="truncate font-display text-base font-semibold text-[var(--color-gold-light)] sm:text-lg">
            {detail ? formatDay(detail.game.playedAt) : gone ? "Struck from the chronicle" : "Unrolling the scroll..."}
          </h2>
          {other ? (
            <p className="text-xs text-muted-foreground">{detail.season ? `Played in ${seasonTitle(detail.season)}` : "Played between two acts"}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the opened game"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-[var(--color-gold)]/10 hover:text-[var(--color-gold-light)] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
      {loading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : gone ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--color-gold)]/25 bg-card/60 p-4">
          <ScrollTextIcon className="mt-0.5 size-5 shrink-0 text-[var(--color-gold)]/80" aria-hidden />
          <p className="text-sm text-muted-foreground">
            This game is no longer in the chronicle. It was most likely a copy recorded twice by accident, and the scribes struck it out. The
            real game still counts once.
          </p>
        </div>
      ) : detail ? (
        <div className="rounded-2xl ring-2 ring-[var(--color-gold)]/50 ring-offset-2 ring-offset-[var(--color-navy)]">
          <MatchCard game={detail.game} defaultOpen highlight={highlight} />
        </div>
      ) : (
        <PageError title="The match scroll is torn" message={error ?? undefined} onRetry={onRetry} retrying={retrying} className="py-6" />
      )}
    </section>
  )
}
