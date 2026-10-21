"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRightIcon, ScrollTextIcon } from "lucide-react"
import { getDecree } from "@/lib/chaos/catalog"
import { changeLines, decreeHeadline } from "@/lib/chaos/format"
import type { ChaosDecreeEntry } from "@/lib/chaos/types"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { DecreeIcon } from "@/components/chaos/decree-icon"
import { SIDE_STYLES, TIER_STYLES } from "@/components/chaos/tier-styles"
import { useNow } from "@/components/chaos/use-now"

function ago(iso: string, now: number): string {
  if (!now) return ""
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

function formatMultiplier(value: number | null): string {
  return value == null ? "2x" : `${Number.isInteger(value) ? value : value.toFixed(1)}x`
}

function StatusChip({ entry }: { entry: ChaosDecreeEntry }) {
  if (entry.status === "refunded") {
    return <span className="rounded-full bg-[var(--color-navy-lighter)] px-2 py-0.5 text-[10px] text-[var(--color-gold-light)]/60">Refunded</span>
  }
  if (entry.action_type !== "double_or_nothing") return null
  if (entry.status === "won") {
    return (
      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        Won +{entry.payout ?? entry.potential_payout} at {formatMultiplier(entry.multiplier)}
      </span>
    )
  }
  if (entry.status === "lost") {
    return <span className="rounded-full bg-[var(--color-red-team)]/12 px-2 py-0.5 text-[10px] text-red-300/90">Lost</span>
  }
  return (
    <span className="rounded-full bg-[var(--color-gold)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-gold)]">
      Riding at {formatMultiplier(entry.multiplier)} · pays {entry.potential_payout ?? entry.cost * 2}
    </span>
  )
}

function LedgerEntry({ entry, mine, now }: { entry: ChaosDecreeEntry; mine: boolean; now: number }) {
  const reduceMotion = useReducedMotion()
  const def = getDecree(entry.action_type)
  const style = TIER_STYLES[def?.tier ?? "wager"]
  const lines = changeLines(entry)

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex gap-3 rounded-lg px-2 py-2.5",
        mine && "bg-[var(--color-gold)]/5 ring-1 ring-[var(--color-gold)]/15",
        entry.status === "refunded" && "opacity-60"
      )}
    >
      <div className="relative shrink-0 self-start">
        <Avatar size="sm" className="size-8">
          {entry.discord_avatar_url && <AvatarImage src={entry.discord_avatar_url} alt="" />}
          <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[11px] text-[var(--color-gold-light)]">
            {entry.actor_name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border bg-[var(--color-navy)]",
            style.border,
            style.text
          )}
        >
          <DecreeIcon type={entry.action_type} className="size-2.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px]">
          <span className="font-semibold text-[var(--color-gold-light)]">{mine ? "You" : entry.actor_name}</span>
          <span className={cn("font-medium", style.text)}>{def?.name ?? "A royal decree"}</span>
          <span className="ml-auto shrink-0 text-[10px] text-[var(--color-gold-light)]/40">{ago(entry.created_at, now)}</span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-[var(--color-gold-light)]/65">{decreeHeadline(entry)}</p>
        {lines.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {lines.map((l) => (
              <li
                key={l.key}
                className="flex items-center gap-1 rounded-md bg-[var(--color-navy)]/80 px-1.5 py-0.5 text-[10px] text-[var(--color-gold-light)]/70"
              >
                <span className={cn("font-semibold", SIDE_STYLES[l.side].text)}>{l.player}</span>
                <span>{l.from}</span>
                <ArrowRightIcon aria-label="to" className="size-2.5 text-[var(--color-gold)]/70" />
                <span className="text-[var(--color-gold-light)]">{l.to}</span>
              </li>
            ))}
          </ul>
        )}
        <motion.div
          key={`${entry.status}-${entry.payout ?? 0}`}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden"
        >
          <StatusChip entry={entry} />
        </motion.div>
      </div>

      <div className="shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--color-gold)]/80">-{entry.cost}</div>
    </motion.li>
  )
}

interface DecreeLedgerProps {
  entries: ChaosDecreeEntry[]
  viewerId: string | null
  windowOpen: boolean
}

export function DecreeLedger({ entries, viewerId, windowOpen }: DecreeLedgerProps) {
  const now = useNow()
  const ordered = [...entries].reverse()

  return (
    <section aria-labelledby="decree-ledger-heading" className="rounded-xl border border-[var(--color-gold)]/10 bg-[var(--color-navy)]/50">
      <div className="flex items-center justify-between border-b border-[var(--color-gold)]/10 px-3 py-2">
        <h3 id="decree-ledger-heading" className="flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-[var(--color-gold)]">
          <ScrollTextIcon aria-hidden className="size-4" />
          Decree ledger
        </h3>
        <span className="text-[11px] tabular-nums text-[var(--color-gold-light)]/50">
          {entries.length} {entries.length === 1 ? "decree" : "decrees"}
        </span>
      </div>
      {ordered.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-[var(--color-gold-light)]/50">
          {windowOpen
            ? "No decrees yet. The court is suspiciously quiet. Salaxe is sharpening his quill."
            : "No decrees were issued this game. A rare day of peace in the kingdom."}
        </p>
      ) : (
        <ul className="max-h-[22rem] space-y-1 overflow-y-auto p-1.5">
          <AnimatePresence initial={false}>
            {ordered.map((entry) => (
              <LedgerEntry key={entry.id} entry={entry} mine={!!viewerId && entry.user_id === viewerId} now={now} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}

export function DecreeLedgerSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-gold)]/10 p-3" aria-hidden>
      <Skeleton className="h-4 w-32 bg-[var(--color-navy-lighter)]/70" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 rounded-full bg-[var(--color-navy-lighter)]/70" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3 bg-[var(--color-navy-lighter)]/70" />
            <Skeleton className="h-3 w-1/2 bg-[var(--color-navy-lighter)]/70" />
          </div>
        </div>
      ))}
    </div>
  )
}
