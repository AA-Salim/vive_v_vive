"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, ScrollTextIcon } from "lucide-react"
import { Segmented } from "@/components/pages/controls"
import { formatDay, formatSigned, formatTime, localDayKey } from "@/components/pages/format"
import { toneOf } from "@/components/pages/indicators"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PointTransaction } from "@/lib/types"
import { reasonLabel, reasonMeta, reasonTone, REASON_TONE_CLASSES } from "@/lib/reasons"
import { cn } from "@/lib/utils"

type Filter = "all" | "income" | "spending"

const PAGE = 20

interface DayGroup {
  key: string
  label: string
  net: number
  rows: PointTransaction[]
}

function groupByDay(rows: PointTransaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const row of rows) {
    const key = localDayKey(row.created_at)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: formatDay(row.created_at), net: 0, rows: [] }
      groups.push(group)
    }
    group.net += row.amount
    group.rows.push(row)
  }
  return groups
}

function LedgerRow({ tx }: { tx: PointTransaction }) {
  const meta = reasonMeta(tx.reason)
  const tone = reasonTone(tx.reason, tx.amount)
  const Icon = meta.icon
  return (
    <li className="flex items-center gap-3 px-1 py-2.5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1", REASON_TONE_CLASSES[tone].chip)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--color-gold-light)]">{reasonLabel(tx.reason, tx.amount)}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta.detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={cn("font-display text-base font-semibold tabular-nums", toneOf(tx.amount))}>{formatSigned(tx.amount)}</span>
        <time dateTime={tx.created_at} className="text-[11px] text-muted-foreground tabular-nums">
          {formatTime(tx.created_at)}
        </time>
      </span>
    </li>
  )
}

export function Ledger({ transactions, loading }: { transactions: PointTransaction[]; loading: boolean }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [visible, setVisible] = useState(PAGE)

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => (filter === "all" ? true : filter === "income" ? tx.amount > 0 : tx.amount < 0)),
    [transactions, filter]
  )
  const groups = useMemo(() => groupByDay(filtered.slice(0, visible)), [filtered, visible])

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Opening the ledger">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Segmented
        label="Filter movements"
        value={filter}
        onChange={(next) => {
          setFilter(next)
          setVisible(PAGE)
        }}
        options={[
          { value: "all", label: "Everything" },
          { value: "income", label: "Income" },
          { value: "spending", label: "Spending" },
        ]}
        className="w-full sm:w-auto"
      />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ScrollTextIcon className="size-6 text-[var(--color-gold)]/60" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "Not a single coin has moved. Suspiciously frugal." : "Nothing on this side of the ledger yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-gold)]/10 pb-1.5">
                <h3 className="text-xs font-semibold tracking-[0.12em] text-[var(--color-gold-light)]/70 uppercase">{group.label}</h3>
                <span className={cn("text-xs font-semibold tabular-nums", toneOf(group.net))}>{formatSigned(group.net)}</span>
              </div>
              <ul className="divide-y divide-[var(--color-gold)]/[0.06]">
                {group.rows.map((tx) => (
                  <LedgerRow key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {filtered.length > visible ? (
        <Button variant="outline" className="h-10 w-full" onClick={() => setVisible((v) => v + PAGE)}>
          <ChevronDownIcon aria-hidden />
          Older movements
        </Button>
      ) : transactions.length >= 50 ? (
        <p className="text-center text-xs text-muted-foreground">The ledger shows your latest 50 movements.</p>
      ) : null}
    </div>
  )
}
