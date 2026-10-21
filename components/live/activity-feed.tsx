"use client"

import { useId } from "react"
import { AnimatePresence } from "motion/react"
import { MegaphoneIcon, RefreshCwIcon, ScrollTextIcon } from "lucide-react"
import { ActivityItem } from "@/components/live/activity-item"
import { useLive } from "@/components/live/live-context"
import { LIVE_LABELS, StatusDot, useLiveDisplayState } from "@/components/live/status-dot"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveFeed } from "@/hooks/use-live-feed"
import { cn } from "@/lib/utils"

interface ActivityFeedProps {
  sessionId: string | null
  limit?: number
  title?: string
  className?: string
}

function FeedSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <Skeleton className={cn("h-3", i === 1 ? "w-3/5" : "w-4/5")} />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
          <Skeleton className="h-2.5 w-6" />
        </div>
      ))}
    </div>
  )
}

function FeedEmpty({ inGame }: { inGame: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/25">
        <ScrollTextIcon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-sm font-semibold text-[var(--color-gold-light)]">
        {inGame ? "The herald clears his throat" : "The court is quiet... for now"}
      </p>
      <p className="max-w-[17rem] text-xs leading-relaxed text-muted-foreground">
        {inGame
          ? "First bet, first decree, first betrayal: it lands here the second it happens."
          : "Start a game, sing for Salaxe or put a price on someone's head. The herald will cry it out."}
      </p>
    </div>
  )
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-7 text-center">
      <p className="text-sm text-[var(--color-gold-light)]">The herald lost his voice.</p>
      <p className="text-xs text-muted-foreground">Live news still arrives. The history will be back shortly.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="h-10 gap-1.5 px-4">
        <RefreshCwIcon aria-hidden />
        Try again
      </Button>
    </div>
  )
}

export function ActivityFeed({ sessionId, limit = 12, title = "The Herald", className }: ActivityFeedProps) {
  const headingId = useId()
  const { status, clockOffset } = useLive()
  const state = useLiveDisplayState(status)
  const { items, isLoading, isError, retry } = useLiveFeed({ sessionId, limit })

  return (
    <section
      aria-labelledby={headingId}
      className={cn("overflow-hidden rounded-xl border border-border bg-card/80 shadow-sm", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/30">
            <MegaphoneIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-sm font-semibold tracking-wide text-[var(--color-gold)]">
              {title}
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {sessionId ? "Live from the Rift" : "Live from the court"}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          <StatusDot state={state} />
          {LIVE_LABELS[state]}
        </span>
      </header>

      {isLoading ? (
        <FeedSkeleton />
      ) : isError ? (
        <FeedError onRetry={() => void retry()} />
      ) : items.length === 0 ? (
        <FeedEmpty inGame={!!sessionId} />
      ) : (
        <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[min(24rem,60vh)]">
          <ol className="space-y-0.5 p-1.5" aria-label="Recent activity">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ActivityItem key={item.event.id} item={item} clockOffset={clockOffset} />
              ))}
            </AnimatePresence>
          </ol>
        </ScrollArea>
      )}
    </section>
  )
}
