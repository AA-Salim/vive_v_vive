"use client"

import { useId, useSyncExternalStore, type ReactNode } from "react"
import { BellOffIcon, RefreshCwIcon, VibrateIcon, Volume2Icon, type LucideIcon } from "lucide-react"
import { useLive } from "@/components/live/live-context"
import { RelativeTime } from "@/components/live/relative-time"
import { LIVE_LABELS, StatusDot, type LiveDisplayState } from "@/components/live/status-dot"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { buzz, canVibrate, playChime, primeAudio } from "@/lib/live/cues"
import { useLivePrefs } from "@/hooks/use-live-prefs"

const EXPLAIN: Record<LiveDisplayState, string> = {
  live: "Connected to the Rift. Bets, decrees and verdicts land here the second they happen. No refresh needed, ever.",
  connecting: "Opening the royal line. Hold your Flash.",
  degraded: "The line dropped. The board still refreshes every few seconds while we reconnect.",
  offline: "You are offline. Everything catches up the moment you are back.",
}

const noopSubscribe = () => () => {}
const vibrationUseful = () => canVibrate() && window.matchMedia("(pointer: coarse)").matches

function clockLine(offset: number) {
  const seconds = Math.round(Math.abs(offset) / 1000)
  if (seconds < 2) return "Timers follow the server clock"
  return `Your clock is ${seconds}s ${offset > 0 ? "ahead" : "behind"}: timers corrected`
}

function PrefRow({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: LucideIcon
  label: string
  hint: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="size-4 shrink-0 text-[var(--color-gold)]/80" aria-hidden />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
      </label>
      <span className="grid min-h-10 min-w-10 place-items-center">
        <Switch id={id} checked={checked} onCheckedChange={(value) => onChange(value)} />
      </span>
    </div>
  )
}

export function LiveSettings({ state }: { state: LiveDisplayState }) {
  const { lastEventAt, clockOffset, resync } = useLive()
  const [prefs, setPrefs] = useLivePrefs()
  const vibrationSupported = useSyncExternalStore(noopSubscribe, vibrationUseful, () => false)

  return (
    <div className="flex flex-col">
      <div className="space-y-1.5 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <StatusDot state={state} pulseKey={lastEventAt} />
          <p className="font-display text-sm font-semibold text-[var(--color-gold-light)]">
            {state === "live" ? "Live sync is on" : LIVE_LABELS[state]}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{EXPLAIN[state]}</p>
        <p className="text-[11px] text-muted-foreground/80">
          {lastEventAt ? (
            <>
              Last news <RelativeTime at={lastEventAt} phrase className="text-foreground/80" />
            </>
          ) : (
            "No news since you arrived. The court is holding its breath."
          )}
        </p>
      </div>

      <div className="border-t border-border/70 py-1">
        <PrefRow
          icon={BellOffIcon}
          label="Quiet mode"
          hint="Only alerts aimed at you: duels, bounties, titles, verdicts."
          checked={prefs.quiet}
          onChange={(quiet) => setPrefs({ quiet })}
        />
        <PrefRow
          icon={Volume2Icon}
          label="Sound"
          hint="A short fanfare for big moments."
          checked={prefs.sound}
          onChange={(sound) => {
            setPrefs({ sound })
            if (sound) {
              primeAudio()
              playChime("royal")
            }
          }}
        />
        {vibrationSupported && (
          <PrefRow
            icon={VibrateIcon}
            label="Vibration"
            hint="A buzz when the Rift calls your name."
            checked={prefs.vibrate}
            onChange={(vibrate) => {
              setPrefs({ vibrate })
              if (vibrate) buzz("info")
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
        <span className="text-[11px] text-muted-foreground">{clockLine(clockOffset)}</span>
        <Button variant="ghost" size="sm" onClick={resync} className="h-10 gap-1.5 px-3 text-xs">
          <RefreshCwIcon aria-hidden />
          Sync now
        </Button>
      </div>
    </div>
  )
}
