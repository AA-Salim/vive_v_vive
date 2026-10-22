"use client"

import { motion, useReducedMotion } from "motion/react"
import { metaFor, TONE_CHIP } from "@/components/live/domain-meta"
import { liveTone } from "@/lib/live/tone"
import { RelativeTime } from "@/components/live/relative-time"
import { HeraldText } from "@/components/titles/herald-text"
import type { FeedItem } from "@/hooks/use-live-feed"
import { cn } from "@/lib/utils"

export function ActivityItem({ item, clockOffset }: { item: FeedItem; clockOffset: number }) {
  const reduceMotion = useReducedMotion() ?? false
  const { event, line } = item
  const meta = metaFor(event.type)
  const Icon = meta.icon

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
      className="relative flex items-start gap-3 rounded-lg px-2.5 py-2"
    >
      {item.live && !reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-[var(--color-gold)]/10 ring-1 ring-[var(--color-gold)]/25"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.2, delay: 0.8, ease: "easeOut" }}
        />
      )}
      <span className={cn("relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1", TONE_CHIP[liveTone(line.tone)])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-[13px] leading-snug wrap-break-word text-foreground">
          <span className="sr-only">{meta.label}: </span>
          <HeraldText text={line.title} actor={event.actor} interactive />
        </p>
        {line.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug wrap-break-word text-muted-foreground">
            {line.description}
          </p>
        )}
      </div>
      <RelativeTime
        at={event.at}
        offset={clockOffset}
        className="relative mt-0.5 shrink-0 text-[11px] text-muted-foreground tabular-nums"
      />
    </motion.li>
  )
}
