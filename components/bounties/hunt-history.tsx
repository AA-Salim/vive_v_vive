"use client"

import { HourglassIcon, TrophyIcon } from "lucide-react"
import { RelativeTime } from "@/components/live/relative-time"
import { useLive } from "@/components/live/live-context"
import { useLiveNow } from "@/hooks/use-live-now"
import type { HuntRecord } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

function names(record: HuntRecord): string {
  const list = record.hunters.map((h) => h.name)
  if (list.length <= 2) return list.join(" and ")
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`
}

export function HuntHistory({ records }: { records: HuntRecord[] }) {
  const { clockOffset } = useLive()
  if (records.length === 0) return null
  return (
    <section aria-labelledby="hunt-history-title" className="space-y-2">
      <h3 id="hunt-history-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Recent hunts
      </h3>
      <ul className="space-y-1.5">
        {records.map((record) => {
          const claimed = record.outcome === "claimed"
          const Icon = claimed ? TrophyIcon : HourglassIcon
          return (
            <li key={record.id} className="flex items-start gap-3 rounded-lg px-2 py-2">
              <span
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1",
                  claimed
                    ? "bg-[var(--color-gold)]/15 text-[var(--color-gold)] ring-[var(--color-gold)]/40"
                    : "bg-muted text-muted-foreground ring-border"
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-foreground">
                  {claimed ? `${record.target.name}'s head: ${record.price} points` : `The warrant on ${record.target.name} expired`}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {claimed
                    ? record.hunters.length > 0
                      ? `Split by ${names(record)}`
                      : "Collected"
                    : `${record.price} points back to ${record.backers} ${record.backers === 1 ? "backer" : "backers"}`}
                  {record.escapes > 0 ? ` · escaped ${record.escapes}x first` : ""}
                </p>
              </div>
              <RelativeTime at={record.closedAt} offset={clockOffset} className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted-foreground" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const FRESH_MS = 3 * 60 * 60 * 1000

// The most recent collected head, for the compact panel: the story of the last game in one line.
export function LastHunt({ record }: { record: HuntRecord | undefined }) {
  const { clockOffset } = useLive()
  const now = useLiveNow()
  if (!record || record.outcome !== "claimed" || !now || now - clockOffset - Date.parse(record.closedAt) > FRESH_MS) return null
  return (
    <p className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--color-gold)]/10 px-3 py-2 text-xs text-[var(--color-gold-light)]/90">
      <TrophyIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {record.target.name}&apos;s head paid {record.price}
        {record.hunters.length > 0 ? ` to ${names(record)}` : ""}
      </span>
      <RelativeTime at={record.closedAt} offset={clockOffset} className="shrink-0 text-[11px] tabular-nums text-muted-foreground" />
    </p>
  )
}
