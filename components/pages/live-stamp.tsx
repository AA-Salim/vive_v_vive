"use client"

import { useLive } from "@/components/live/live-context"
import { RelativeTime } from "@/components/live/relative-time"
import { LIVE_LABELS, StatusDot, useLiveDisplayState } from "@/components/live/status-dot"
import { cn } from "@/lib/utils"

interface LiveStampProps {
  updatedAt: number
  fetching?: boolean
  className?: string
}

// Tells the reader the page keeps itself fresh: no refresh button, just the time of the last update.
export function LiveStamp({ updatedAt, fetching = false, className }: LiveStampProps) {
  const { status, lastEventAt } = useLive()
  const state = useLiveDisplayState(status)
  return (
    <p
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card/60 px-3 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      <StatusDot state={state} pulseKey={lastEventAt} />
      <span className="font-semibold tracking-[0.14em] uppercase">{LIVE_LABELS[state]}</span>
      <span aria-hidden className="h-3 w-px bg-border" />
      {fetching ? (
        <span>Updating...</span>
      ) : updatedAt > 0 ? (
        <span>
          Updated <RelativeTime at={updatedAt} phrase />
        </span>
      ) : (
        <span>Waiting for news</span>
      )}
    </p>
  )
}
