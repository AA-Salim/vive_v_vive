"use client"

import { NotebookPenIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { HallRecent } from "@/components/betting/hall/hall-recent"
import { HallRecords } from "@/components/betting/hall/hall-records"
import { HallStandings } from "@/components/betting/hall/hall-standings"
import { useHall } from "@/components/betting/hall/use-hall"
import { useLive } from "@/components/live/live-provider"
import { HALL_HELP, HALL_TOTALS_HELP } from "@/lib/betting/help"
import { SeasonPicker } from "@/components/pages/season-picker"
import { useSeasonParam } from "@/components/pages/use-season"
import { formatSigned } from "@/lib/betting/math"
import type { HallOfFame } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

function Totals({ totals }: { totals: HallOfFame["totals"] }) {
  const items: Array<{ key: keyof typeof HALL_TOTALS_HELP; value: number; signed?: boolean }> = [
    { key: "wagered", value: totals.wagered },
    { key: "bets", value: totals.bets },
    { key: "bettors", value: totals.bettors },
    { key: "recovered", value: totals.recovered, signed: true },
    { key: "bonus", value: totals.bonus, signed: true },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => {
        const help = HALL_TOTALS_HELP[item.key]
        return (
          <div key={item.key} className={cn("rounded-xl border border-[var(--color-gold)]/15 bg-card px-3 py-2.5", i === 0 && "col-span-2 sm:col-span-1")}>
            <dt className="flex items-start justify-between gap-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="min-w-0 leading-snug">{help.title}</span>
              <InfoTip help={help} align="end" className="-my-1 -mr-1" />
            </dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-[var(--color-gold-light)]">
              <AnimatedNumber from={0} value={item.value} format={item.signed ? formatSigned : undefined} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function HallSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading the hall">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-16 rounded-xl", i === 0 && "col-span-2 sm:col-span-1")} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}

export function GamblingHall() {
  const [season, setSeason] = useSeasonParam()
  const hall = useHall(season)
  const { userId } = useLive()
  const data = hall.data
  const actName = data?.act?.name ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Gamba</p>
          <div className="flex items-center gap-1.5">
            <h1 className="font-display text-3xl font-semibold text-[var(--color-gold)] sm:text-4xl">{HALL_HELP.title}</h1>
            <InfoTip help={HALL_HELP} align="start" />
          </div>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-gold-light)]/70">
            {data?.scope === "act" && actName
              ? `Every wager of ${actName}. Glory for the sharp, a page in Salaxe's notebook for everyone else.`
              : "Every wager ever written in the little notebook. Glory for the sharp, shame for the rest."}
          </p>
        </div>
        <SeasonPicker value={season} onChange={setSeason} className="w-full sm:w-auto" />
      </header>

      {hall.isPending ? (
        <HallSkeleton />
      ) : !data ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-gold)]/20 bg-card px-4 py-10 text-center">
          <NotebookPenIcon className="size-8 text-[var(--color-gold)]/70" aria-hidden />
          <p className="font-display text-lg font-semibold text-[var(--color-gold)]">The hall is closed for repairs</p>
          <Button variant="outline" onClick={() => hall.refetch()} disabled={hall.isFetching} className="h-10">
            <RefreshCwIcon className={hall.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Try again
          </Button>
        </div>
      ) : data.totals.bets === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-gold)]/25 bg-card px-4 py-12 text-center">
          <NotebookPenIcon className="size-8 text-[var(--color-gold)]/70" aria-hidden />
          <p className="font-display text-lg font-semibold text-[var(--color-gold)]">The notebook is blank</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {data.scope === "act" ? "No settled wagers in this act yet." : "No settled wagers yet."} The first bettor to cash out gets a name in gold.
          </p>
        </div>
      ) : (
        <>
          <Totals totals={data.totals} />
          <HallRecords records={data.records} />
          <div className="grid gap-4 lg:grid-cols-2">
            <HallStandings standings={data.standings} viewerId={userId} />
            <HallRecent bets={data.recent} />
          </div>
        </>
      )}
    </div>
  )
}
