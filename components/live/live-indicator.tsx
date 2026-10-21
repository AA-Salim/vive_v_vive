"use client"

import { BellOffIcon } from "lucide-react"
import { useLive } from "@/components/live/live-context"
import { LiveSettings } from "@/components/live/live-settings"
import { LIVE_LABELS, StatusDot, useLiveDisplayState } from "@/components/live/status-dot"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLivePrefs } from "@/hooks/use-live-prefs"
import { cn } from "@/lib/utils"

interface LiveIndicatorProps {
  // Hides the text label (kept for screen readers) where the nav is tight.
  compact?: boolean
  className?: string
}

export function LiveIndicator({ compact = false, className }: LiveIndicatorProps) {
  const { status, lastEventAt } = useLive()
  const [prefs] = useLivePrefs()
  const state = useLiveDisplayState(status)
  const label = LIVE_LABELS[state]

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Live sync: ${label}${prefs.quiet ? ", quiet mode on" : ""}. Open notification settings`}
        className={cn(
          "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase transition-colors outline-none hover:border-[var(--color-gold)]/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:border-[var(--color-gold)]/50 data-[popup-open]:text-foreground",
          state === "live" && "text-[var(--color-gold-light)]/80",
          className
        )}
      >
        <StatusDot state={state} pulseKey={lastEventAt} />
        <span className={cn(compact && "sr-only")}>{label}</span>
        {prefs.quiet && <BellOffIcon className="size-3.5 text-muted-foreground" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(20rem,calc(100vw-1.5rem))] gap-0 p-0">
        <LiveSettings state={state} />
      </PopoverContent>
    </Popover>
  )
}
