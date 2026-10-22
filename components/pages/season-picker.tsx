"use client"

import { CalendarRangeIcon } from "lucide-react"
import { formatShortDay } from "@/components/pages/format"
import { resolveSeasonKey, useSeasonParam, useSeasons, type SeasonKey } from "@/components/pages/use-season"
import { InfoTip } from "@/components/ui/info-tip"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "@/components/ui/select"
import type { HelpEntry } from "@/lib/help"
import { currentSeason, seasonTitle } from "@/lib/pages/season-calendar"
import type { Season } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const ALL = "all"

export const SEASON_HELP: HelpEntry = {
  title: "Seasons (acts)",
  does: "The court plays in acts: each one has its own story, its own treasury and its own record books. Every page shows the act being played unless you pick another one, and your pick follows you from tab to tab. All time adds every act together.",
  cost: "Nothing. Switching only changes which games you read, and the link you share keeps your pick.",
  limits: "A game counts in the act it was played in. Balances restart with every act, games are never lost.",
}

export const TREASURY_HELP: HelpEntry = {
  title: "The act's treasury",
  does: "Every act opens a fresh treasury. The balances, ranks, records and devotion on this page count one act only. Pick a past act to read its final standings, sealed the day it closed.",
  cost: "Nothing to read. Coins move with games, wagers, decrees and praise.",
  limits: "There is no all-time treasury: balances restart when a new act begins.",
}

export function seasonKicker(season: Season | null, firstStart?: string): string {
  if (!season) return firstStart ? `Every act · since ${formatShortDay(firstStart)}` : "Every act"
  if (season.status === "active") return `Now playing · since ${formatShortDay(season.startedAt)}`
  return `Sealed · ${formatShortDay(season.startedAt)} - ${season.endedAt ? formatShortDay(season.endedAt) : "today"}`
}

function Dot({ season }: { season: Season | null | undefined }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", season?.status === "active" ? "bg-emerald-400" : "bg-[var(--color-gold)]/70")}
    />
  )
}

function SeasonText({ season, kicker, small }: { season: Season | null | undefined; kicker: string; small?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start text-left">
      {small ? null : (
        <span className="flex max-w-full items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <Dot season={season} />
          <span className="truncate">{kicker}</span>
        </span>
      )}
      <span
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 font-display font-semibold text-[var(--color-gold-light)]",
          small ? "text-sm" : "text-[15px] leading-snug"
        )}
      >
        {small ? <Dot season={season} /> : null}
        <span className="truncate">{season === undefined ? "Reading the calendar..." : seasonTitle(season)}</span>
      </span>
    </span>
  )
}

export interface SeasonPickerProps {
  value: SeasonKey
  onChange: (next: SeasonKey) => void
  // The season the data on screen was computed for, once it arrived.
  served?: Season | null
  // Pages whose numbers restart every act (the treasury) have no all-time view.
  allowAll?: boolean
  help?: HelpEntry
  size?: "default" | "sm"
  className?: string
}

// Which act a page reads, and the switch to read another one.
export function SeasonPicker({ value, onChange, served, allowAll = true, help = SEASON_HELP, size = "default", className }: SeasonPickerProps) {
  const seasons = useSeasons()
  const list = seasons.data
  const shown = resolveSeasonKey(value, list, served)
  const live = list ? currentSeason(list) : served?.status === "active" ? served : null
  const ordered = list ? [...list].sort((x, y) => (x.status === "active" ? -1 : y.status === "active" ? 1 : y.number - x.number)) : []
  const options = ordered.length > 0 ? ordered : shown ? [shown] : []
  const firstStart = list?.[0]?.startedAt
  const small = size === "sm"
  const unknown = typeof value === "number" && list !== undefined && shown === undefined
  const kicker = unknown ? "Unknown act" : shown === undefined ? "Season" : seasonKicker(shown, firstStart)
  const label = unknown ? `Act ${value} is not in the calendar` : shown === undefined ? "Loading the season" : seasonTitle(shown)

  const pick = (next: string | null) => {
    if (!next) return
    if (next === ALL) return onChange("all")
    const number = Number(next)
    onChange(live && live.number === number ? "current" : number)
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Select value={value === "all" ? ALL : shown ? String(shown.number) : null} onValueChange={pick}>
        <SelectTrigger
          aria-label={`Season: ${label}. Change season`}
          className={cn(
            "min-w-0 border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 text-left data-[size=default]:h-auto",
            small ? "h-10 w-full gap-2 rounded-lg px-3 sm:w-auto sm:max-w-64" : "min-h-12 w-full gap-2.5 rounded-xl py-1.5 pr-3 pl-1.5 sm:w-auto sm:min-w-72"
          )}
        >
          {small ? null : (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/25">
              <CalendarRangeIcon className="size-4" aria-hidden />
            </span>
          )}
          {unknown ? (
            <span className="min-w-0 flex-1 truncate text-sm text-rose-300">Unknown act {value}</span>
          ) : (
            <SeasonText season={shown} kicker={kicker} small={small} />
          )}
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width) sm:min-w-72">
          {options.map((season) => (
            <SelectItem key={season.number} value={String(season.number)} className="py-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{seasonTitle(season)}</span>
                <span className="text-[11px] text-muted-foreground">{seasonKicker(season)}</span>
              </span>
            </SelectItem>
          ))}
          {allowAll ? (
            <>
              {options.length > 0 ? <SelectSeparator /> : null}
              <SelectItem value={ALL} className="py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">All time</span>
                  <span className="text-[11px] text-muted-foreground">{firstStart ? `Every act since ${formatShortDay(firstStart)}` : "Every act together"}</span>
                </span>
              </SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>
      <InfoTip help={help} align="end" />
    </div>
  )
}

// The picker wired to the URL (?act=), for pages that read their season with useSeasonParam() too.
export function SeasonFilter(props: Omit<SeasonPickerProps, "value" | "onChange">) {
  const [season, setSeason] = useSeasonParam()
  return <SeasonPicker value={season} onChange={setSeason} {...props} />
}
