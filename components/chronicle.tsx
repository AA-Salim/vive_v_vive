"use client"

import { useId, useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDownIcon, FeatherIcon, NewspaperIcon, RotateCcwIcon, ScrollTextIcon } from "lucide-react"
import { ChronicleSkeleton, ENTRY_META, GameStrip, NightStats } from "@/components/lore/chronicle-parts"
import { LoreText } from "@/components/lore/lore-text"
import { Button } from "@/components/ui/button"
import { useChronicle, useChronicleSync } from "@/hooks/use-chronicle"
import type { ChronicleEntry, ChronicleNight, GazetteFact } from "@/lib/lore/chronicle/types"
import { cn } from "@/lib/utils"

const VISIBLE_ENTRIES = 4

function nightLabel(night: ChronicleNight): string {
  const start = new Date(night.startedAt)
  const end = new Date(night.endedAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ""
  const day = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(start)
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
  return night.games.length > 1 ? `${day} · ${time.format(start)} to ${time.format(end)}` : `${day} · ${time.format(start)}`
}

function EntryRow({ entry, index, animate }: { entry: ChronicleEntry; index: number; animate: boolean }) {
  const meta = ENTRY_META[entry.kind]
  const Icon = meta.icon
  return (
    <motion.li
      initial={animate ? { opacity: 0, y: 8 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ duration: 0.35, delay: animate ? Math.min(index, 6) * 0.07 : 0, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1", meta.tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-pretty break-words text-[var(--color-gold-light)]/85">
        <span className="sr-only">{meta.label}: </span>
        <LoreText segments={entry.segments} />
      </p>
    </motion.li>
  )
}

function Gazette({ facts }: { facts: GazetteFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="border-t border-[var(--color-gold)]/12 bg-[var(--color-navy)]/45 px-4 py-3.5 sm:px-5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <NewspaperIcon className="size-3.5 text-[var(--color-gold)]/70" aria-hidden />
        The Court Gazette
      </p>
      <ul className="mt-2 space-y-1.5">
        {facts.map((fact) => (
          <li key={fact.id} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-[var(--color-gold)]/60" />
            <LoreText segments={fact.segments} className="min-w-0 break-words" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Shell({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/20 bg-card shadow-xl shadow-black/30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-[var(--color-gold)]/6 blur-3xl" />
      {children}
    </section>
  )
}

function NightView({ night, gazette }: { night: ChronicleNight; gazette: GazetteFact[] }) {
  const titleId = useId()
  const restId = useId()
  const reduceMotion = useReducedMotion() ?? false
  const [expanded, setExpanded] = useState(false)
  const head = night.entries.slice(0, VISIBLE_ENTRIES)
  const rest = night.entries.slice(VISIBLE_ENTRIES)
  const when = nightLabel(night)

  return (
    <Shell labelledBy={titleId}>
      <div className="relative flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-gold)]/10 ring-1 ring-[var(--color-gold)]/25">
          <ScrollTextIcon className="size-5 text-[var(--color-gold)]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--color-gold)]/85 uppercase">
            {night.ongoing ? "Tonight on Vive v Vive" : "Previously on Vive v Vive..."}
          </p>
          <h2 id={titleId} className="mt-1 font-display text-xl leading-tight font-semibold text-balance text-foreground sm:text-2xl">
            <LoreText segments={night.episode.segments} />
          </h2>
          {when && <p className="mt-1 text-xs text-muted-foreground">{when}</p>}
        </div>
      </div>

      <div className="relative space-y-2.5 px-4 pt-4 sm:px-5">
        <NightStats stats={night.stats} />
        <GameStrip games={night.games} />
      </div>

      <ul className="relative space-y-3 px-4 pt-4 pb-1 sm:px-5" aria-label="The chronicle">
        {head.map((entry, i) => (
          <EntryRow key={entry.id} entry={entry} index={i} animate={!reduceMotion} />
        ))}
      </ul>

      <AnimatePresence initial={false}>
        {expanded && rest.length > 0 && (
          <motion.div
            id={restId}
            key="rest"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ul className="space-y-3 px-4 pt-2 pb-1 sm:px-5">
              {rest.map((entry, i) => (
                <EntryRow key={entry.id} entry={entry} index={i} animate={!reduceMotion} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative px-2 pt-1 pb-2 sm:px-3">
        {rest.length > 0 ? (
          <Button
            variant="ghost"
            className="h-10 w-full justify-center gap-1.5 text-[var(--color-gold)] hover:text-[var(--color-gold-light)] sm:w-auto"
            aria-expanded={expanded}
            aria-controls={restId}
            onClick={() => setExpanded((v) => !v)}
          >
            <FeatherIcon aria-hidden />
            {expanded ? "Fold the scroll" : `Read the full chronicle (${rest.length} more)`}
            <ChevronDownIcon aria-hidden className={cn("transition-transform", expanded && "rotate-180")} />
          </Button>
        ) : (
          <div className="h-2" />
        )}
      </div>

      <Gazette facts={gazette} />
    </Shell>
  )
}

function EmptyView({ gazette }: { gazette: GazetteFact[] }) {
  const titleId = useId()
  return (
    <Shell labelledBy={titleId}>
      <div className="relative flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-[var(--color-gold)]/10 ring-1 ring-[var(--color-gold)]/25">
          <FeatherIcon className="size-5 text-[var(--color-gold)]" aria-hidden />
        </span>
        <h2 id={titleId} className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
          The chronicle is blank
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          No game on record yet. The scribes are sharpening their quills; ten players and one draft and history begins.
        </p>
      </div>
      <Gazette facts={gazette} />
    </Shell>
  )
}

export function Chronicle() {
  const { data, isPending, isError, refetch, isFetching } = useChronicle()
  useChronicleSync()

  if (isPending) return <ChronicleSkeleton />
  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center">
        <ScrollTextIcon className="size-7 text-[var(--color-gold)]" aria-hidden />
        <p className="font-display text-base text-[var(--color-gold-light)]">The chronicle fell in the river</p>
        <p className="max-w-xs text-sm text-muted-foreground">The scribes could not fetch the last night. The night still happened, sadly.</p>
        <Button variant="outline" className="h-10" onClick={() => void refetch()} disabled={isFetching}>
          <RotateCcwIcon aria-hidden />
          Try again
        </Button>
      </div>
    )
  }
  if (!data?.night) return <EmptyView gazette={data?.gazette ?? []} />
  return <NightView night={data.night} gazette={data.gazette} />
}
