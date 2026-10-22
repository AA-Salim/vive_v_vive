"use client"

import Link from "next/link"
import { ArrowRightIcon, CheckIcon, GiftIcon } from "lucide-react"
import { formatNumber } from "@/components/pages/format"
import { PageError } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"
import { MILESTONE_GROUPS } from "@/lib/milestones"
import { useMilestones } from "@/lib/titles/use-titles"
import type { MilestoneView } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

function GroupRow({ label, blurb, items }: { label: string; blurb: string; items: MilestoneView[] }) {
  const sorted = [...items].sort((x, y) => x.threshold - y.threshold)
  const unlocked = sorted.filter((m) => m.unlocked)
  const next = sorted.find((m) => !m.unlocked) ?? null
  const current = sorted[0]?.current ?? 0
  const progress = next ? Math.max(0, Math.min(1, current / Math.max(1, next.threshold))) : 1
  const isRate = sorted[0]?.stat === "win_rate"

  return (
    <li className="min-w-0 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-gold-light)]">{label}</p>
          <p className="truncate text-xs text-muted-foreground" title={blurb}>
            {unlocked.length > 0 ? `Holds "${unlocked[unlocked.length - 1].title}"` : blurb}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1" aria-label={`${unlocked.length} of ${sorted.length} tiers`}>
          {sorted.map((m) => (
            <span
              key={m.id}
              title={`${m.title}: ${m.description}`}
              className={cn(
                "size-2 rounded-full",
                m.claimed ? "bg-[var(--color-gold)]" : m.unlocked ? "bg-[var(--color-gold)]/50 ring-1 ring-[var(--color-gold)]" : "bg-[var(--color-gold-light)]/12"
              )}
            />
          ))}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-gold-light)]/[0.07]" aria-hidden>
          <div className="h-full rounded-full bg-[var(--color-gold)]/70" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {next
            ? `${isRate ? `${Math.round(current)}%` : formatNumber(Math.floor(current))} / ${isRate ? `${next.threshold}%` : formatNumber(next.threshold)}`
            : "Maxed out"}
        </span>
      </div>
    </li>
  )
}

export function AchievementsCard() {
  const query = useMilestones(true)
  const milestones = query.data?.milestones

  if (query.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Counting your deeds">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (!milestones) {
    return (
      <PageError
        title="The book of deeds is locked"
        message={query.error?.message ?? "Your milestones could not be read."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className="py-6"
      />
    )
  }

  const unlocked = milestones.filter((m) => m.unlocked).length
  const claimable = milestones.filter((m) => m.unlocked && !m.claimed).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-gold)]/10 px-2.5 text-xs font-semibold text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/25">
          <CheckIcon className="size-3.5" aria-hidden />
          {unlocked} of {milestones.length} unlocked
        </span>
        {claimable > 0 ? (
          <Link
            href="/titles"
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-400/15"
          >
            <GiftIcon className="size-3.5" aria-hidden />
            {claimable} ready to engrave
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-[var(--color-gold)]/[0.06]">
        {MILESTONE_GROUPS.map((group) => {
          const items = milestones.filter((m) => m.group === group.key)
          return items.length > 0 ? <GroupRow key={group.key} label={group.label} blurb={group.blurb} items={items} /> : null
        })}
      </ul>
    </div>
  )
}
