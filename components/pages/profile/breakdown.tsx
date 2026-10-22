"use client"

import { formatNumber } from "@/components/pages/format"
import { InfoTip } from "@/components/ui/info-tip"
import { groupHelp } from "@/lib/economy"
import type { ReasonTotal } from "@/lib/pages/types"
import { reasonMeta, REASON_GROUPS, type ReasonGroup } from "@/lib/reasons"
import { cn } from "@/lib/utils"

interface GroupTotal {
  group: ReasonGroup
  total: number
  count: number
}

function totalsBySign(breakdown: ReasonTotal[], sign: 1 | -1): GroupTotal[] {
  const byGroup = new Map<ReasonGroup, GroupTotal>()
  for (const row of breakdown) {
    if (Math.sign(row.total) !== sign) continue
    const group = reasonMeta(row.reason).group
    const entry = byGroup.get(group) ?? { group, total: 0, count: 0 }
    entry.total += Math.abs(row.total)
    entry.count += row.count
    byGroup.set(group, entry)
  }
  return [...byGroup.values()].sort((x, y) => y.total - x.total)
}

function Column({ title, rows, kind }: { title: string; rows: GroupTotal[]; kind: "income" | "spending" }) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kind === "income" ? "Nothing earned yet." : "Not a coin spent. Yet."}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const meta = REASON_GROUPS[row.group]
            const Icon = meta.icon
            return (
              <li key={row.group} className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-[var(--color-gold-light)]/85">
                    <Icon className="size-3.5 shrink-0 text-[var(--color-gold)]/70" aria-hidden />
                    <span className="truncate">{meta.label}</span>
                    <InfoTip help={groupHelp(row.group, meta.label)} className="-my-1" />
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", kind === "income" ? "text-emerald-300" : "text-rose-300")}>
                    {kind === "income" ? "+" : "-"}
                    {formatNumber(row.total)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-gold-light)]/[0.06]" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", kind === "income" ? "bg-emerald-400/60" : "bg-rose-400/60")}
                    style={{ width: `${Math.max(3, (row.total / max) * 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Breakdown({ breakdown }: { breakdown: ReasonTotal[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
      <Column title="Where it came from" rows={totalsBySign(breakdown, 1)} kind="income" />
      <Column title="Where it went" rows={totalsBySign(breakdown, -1)} kind="spending" />
    </div>
  )
}
