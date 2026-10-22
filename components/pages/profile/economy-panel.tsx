"use client"

import { useEffect, useMemo } from "react"
import { CrownIcon, ScaleIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { DEBT_FLOOR, economyEntries, FLOW_LABELS, rangeOf, type EconomyEntry, type EconomyFlow } from "@/lib/economy"
import { REASON_GROUPS } from "@/lib/reasons"
import type { TitleView } from "@/lib/titles/types"
import { useTitlesCatalog } from "@/lib/titles/use-titles"
import { cn } from "@/lib/utils"

const FLOWS: EconomyFlow[] = ["earn", "risk", "spend"]

const FLOW_TONE: Record<EconomyFlow, { amount: string; chip: string }> = {
  earn: { amount: "text-emerald-300", chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" },
  risk: { amount: "text-[var(--color-gold)]", chip: "bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-[var(--color-gold)]/25" },
  spend: { amount: "text-rose-300", chip: "bg-rose-400/10 text-rose-300 ring-rose-400/25" },
}

function shopRanges(titles: TitleView[] | undefined) {
  const priced = (titles ?? []).filter((t) => t.category !== "award" && t.price > 0)
  const own = priced.filter((t) => t.for_self).map((t) => t.price)
  const brands = priced.filter((t) => !t.for_self).map((t) => t.price)
  return { titlePrices: own.length ? rangeOf(own) : null, brandPrices: brands.length ? rangeOf(brands) : null }
}

// The live shop prices refine the title rows; everything else comes from the rule constants.
export function useEconomy(startingPurse: number | null | undefined): EconomyEntry[] {
  const catalog = useTitlesCatalog()
  const titles = catalog.data?.titles
  return useMemo(() => economyEntries({ startingPurse, ...shopRanges(titles) }), [startingPurse, titles])
}

function EconomyRow({ entry }: { entry: EconomyEntry }) {
  const Icon = entry.featured ? CrownIcon : REASON_GROUPS[entry.group].icon
  const tone = FLOW_TONE[entry.flow]
  const line = entry.flow === "earn" ? entry.help.reward : entry.help.cost
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-1.5 py-2",
        entry.featured && "bg-[var(--color-gold)]/[0.07] ring-1 ring-[var(--color-gold)]/30"
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", tone.chip)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="min-w-0 truncate text-sm font-medium text-[var(--color-gold-light)]">{entry.help.title}</span>
          {entry.featured ? (
            <span className="shrink-0 rounded-full bg-[var(--color-gold)]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[var(--color-gold)] uppercase">
              Best daily deal
            </span>
          ) : null}
        </span>
        {line ? <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{line}</span> : null}
      </span>
      <span className={cn("shrink-0 font-display text-sm font-semibold tabular-nums", tone.amount)}>{entry.amount}</span>
      <InfoTip help={entry.help} side="top" align="end" />
    </li>
  )
}

export function EconomyPanel({ entries }: { entries: EconomyEntry[] }) {
  useEffect(() => {
    if (window.location.hash === "#economy") document.getElementById("economy")?.scrollIntoView({ block: "start" })
  }, [])

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <ScaleIcon className="mt-0.5 size-4 shrink-0 text-rose-300" aria-hidden />
        <span>
          <span className="font-semibold text-rose-200">Debt floor {DEBT_FLOOR}.</span> You can spend into debt, but nothing goes through
          if it would leave you below {DEBT_FLOOR}. Every new act wipes every purse and every debt.
        </span>
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        {FLOWS.map((flow) => (
          <section key={flow} aria-labelledby={`economy-${flow}`} className="min-w-0">
            <h3 id={`economy-${flow}`} className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {FLOW_LABELS[flow].title}
            </h3>
            <p className="mb-1.5 text-xs text-muted-foreground/80">{FLOW_LABELS[flow].blurb}</p>
            <ul className="space-y-0.5">
              {entries
                .filter((entry) => entry.flow === flow)
                .map((entry) => (
                  <EconomyRow key={entry.key} entry={entry} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
