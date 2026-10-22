"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRightIcon, BookOpenIcon, CrownIcon, SwordsIcon, UsersIcon } from "lucide-react"
import { useLiveRefetch } from "@/components/live/live-context"
import { PlayerAvatar } from "@/components/pages/avatars"
import { actLore, romanOf } from "@/components/pages/archives/act-lore"
import { daysBetween, formatNumber, formatShortDay, plural } from "@/components/pages/format"
import { PageHeader } from "@/components/pages/page-header"
import { useArchives } from "@/components/pages/queries"
import { PageEmpty, PageError } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"
import { ARCHIVES_HELP } from "@/lib/pages/help"
import type { ArchiveSummary } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

function ActCard({ act, index }: { act: ArchiveSummary; index: number }) {
  const reduced = useReducedMotion()
  const live = act.status === "active"
  const days = daysBetween(act.startedAt, act.endedAt)
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduced ? 0 : index * 0.08 }}
      className="relative pl-8 sm:pl-12"
    >
      <span aria-hidden className="absolute top-0 bottom-0 left-3 w-px bg-linear-to-b from-[var(--color-gold)]/50 to-[var(--color-gold)]/5 sm:left-5" />
      <span
        aria-hidden
        className={cn(
          "absolute top-6 left-[5px] grid size-[15px] place-items-center rounded-full ring-4 ring-[var(--color-navy)] sm:left-[13px]",
          live ? "bg-emerald-400" : "bg-[var(--color-gold)]"
        )}
      />
      <Link
        href={`/archives/${act.id}`}
        className={cn(
          "group relative block overflow-hidden rounded-2xl border bg-card p-4 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5",
          live ? "border-emerald-400/30 hover:border-emerald-400/50" : "border-[var(--color-gold)]/25 hover:border-[var(--color-gold)]/50"
        )}
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-40 w-64 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold tracking-[0.2em] text-[var(--color-gold)] uppercase">Act {romanOf(act.number)}</span>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold tracking-wider uppercase ring-1",
                  live ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30" : "bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-[var(--color-gold)]/30"
                )}
              >
                {live ? "Now playing" : "Sealed"}
              </span>
            </div>
            <h2 className="font-display text-2xl leading-tight font-semibold text-[var(--color-gold-light)] sm:text-3xl">{act.subtitle ?? act.name}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--color-gold-light)]/70">{actLore(act.number, act.subtitle)}</p>
            <p className="text-xs text-muted-foreground">
              {formatShortDay(act.startedAt)} - {act.endedAt ? formatShortDay(act.endedAt) : "today"} · {plural(days, "day")}
            </p>
          </div>
          {act.champion ? (
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 p-3">
              <PlayerAvatar name={act.champion.name} src={act.champion.avatarUrl} size="md" ring="gold" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  <CrownIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
                  {live ? "Leading" : "Crowned"}
                </p>
                <p className="truncate font-semibold text-[var(--color-gold-light)]">{act.champion.name}</p>
                <p className="text-xs text-[var(--color-gold)] tabular-nums">{formatNumber(act.champion.balance)} points</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-gold)]/10 pt-3">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <SwordsIcon className="size-3.5 text-[var(--color-gold)]/60" aria-hidden />
              {plural(act.games, "game")}
            </span>
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3.5 text-[var(--color-gold)]/60" aria-hidden />
              {plural(act.participants, "noble")}
            </span>
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gold)]">
            {live ? "The story so far" : "Read the chronicle"}
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </motion.li>
  )
}

export function ArchivesView() {
  const query = useArchives()
  const acts = [...(query.data?.acts ?? [])].sort((x, y) => y.number - x.number)
  const { refetch } = query

  // The running act's leader and game count move with every game, unlike the sealed chapters.
  useLiveRefetch(() => void refetch(), { domains: ["session", "points", "bet", "chaos", "praise"], tables: ["point_balances"] })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="The Royal Archives"
        title="Archives"
        description="Every act of the saga, sealed and shelved. Kings rise, kings fall, and the scribes write all of it down."
        help={ARCHIVES_HELP}
      />
      {query.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Dusting off the archives">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-60 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError && acts.length === 0 ? (
        <PageError title="The archive doors are stuck" message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : acts.length === 0 ? (
        <PageEmpty icon={BookOpenIcon} title="The shelves are empty">
          The first act has not begun. History waits for its first chapter.
        </PageEmpty>
      ) : (
        <ol className="space-y-5" aria-label="Acts, newest first">
          {acts.map((act, i) => (
            <ActCard key={act.id} act={act} index={i} />
          ))}
        </ol>
      )}
    </div>
  )
}
