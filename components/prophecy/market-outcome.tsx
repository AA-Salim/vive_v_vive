import { TONES } from "@/components/prophecy/category-meta"
import { CATEGORIES } from "@/lib/prophecy/constants"
import { CATEGORY_COPY } from "@/lib/prophecy/lines"
import type { VerdictMarket, VerdictSummary } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

export function describeMarket(market: VerdictMarket): string {
  if (market.prophets === 0) return "No prophets on this one."
  if (market.outcome !== "decided") return `No verdict. ${market.pot} returned to ${plural(market.prophets, "prophet")}.`
  if (market.refunded) return `Nobody called it. ${market.pot} returned to ${plural(market.prophets, "prophet")}.`
  if (market.hits === market.prophets) return `Everyone called it. ${plural(market.hits, "prophet")} got their stake back and then some respect.`
  return `${plural(market.hits, "prophet")} called it and split ${market.paid}.`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

export function MarketOutcome({ summary }: { summary: VerdictSummary }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CATEGORIES.map((category) => {
        const tone = TONES[category]
        const Icon = tone.icon
        const market = summary[category]
        const winner = market.outcome === "decided" && market.names.length > 0 ? market.names.join(" & ") : "No verdict"
        return (
          <div key={category} className={cn("rounded-xl border bg-[var(--color-navy)]/60 p-3", tone.border)}>
            <div className={cn("flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase", tone.text)}>
              <Icon className="size-3.5" aria-hidden />
              {CATEGORY_COPY[category].crowned}
            </div>
            <div className="mt-1 truncate font-display text-base font-semibold text-foreground">{winner}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{describeMarket(market)}</p>
          </div>
        )
      })}
    </div>
  )
}
