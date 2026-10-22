"use client"

import { motion, useReducedMotion } from "motion/react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { PlayerAvatar } from "@/components/bounties/player-avatar"
import { TimeLeft } from "@/components/bounties/time-left"
import type { WarrantView } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface WarrantRowProps {
  warrant: WarrantView
  canPledge: boolean
  isMe: boolean
  live: boolean
  onOpen: (warrant: WarrantView) => void
  onPledge: (warrant: WarrantView) => void
}

function subline(warrant: WarrantView): string {
  const parts = [warrant.kind === "legacy" ? "old terms" : `${warrant.backers.length} ${warrant.backers.length === 1 ? "backer" : "backers"}`]
  if (warrant.escapes > 0) parts.push(`escaped ${warrant.escapes}x`)
  return parts.join(" · ")
}

export function WarrantRow({ warrant, canPledge, isMe, live, onOpen, onPledge }: WarrantRowProps) {
  const reduce = useReducedMotion()
  const hot = warrant.price >= 100
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className={cn(
        "flex items-center gap-1 rounded-xl border bg-[var(--color-navy)]/50 pr-1 transition-colors hover:border-[var(--color-red-team)]/30",
        live ? "border-[var(--color-red-team)]/40" : "border-transparent"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(warrant)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-red-team)]/50"
        aria-label={`Wanted: ${warrant.target.name}, ${warrant.price} points. Open the warrant.`}
      >
        <PlayerAvatar
          name={warrant.target.name}
          avatarUrl={warrant.target.avatarUrl}
          className={cn("ring-2", hot ? "ring-[var(--color-red-team)]/70" : "ring-[var(--color-red-team)]/30")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--color-gold-light)]">
            {warrant.target.name}
            {isMe && <span className="ml-1.5 text-[11px] font-normal text-[var(--color-red-team)]">(you)</span>}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {live ? (
              <span className="font-semibold text-[var(--color-red-team)]">
                <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-[var(--color-red-team)] align-middle motion-safe:animate-pulse" />
                Hunt live: this game settles it
              </span>
            ) : (
              <>
                {subline(warrant)} · <TimeLeft until={warrant.expiresAt} />
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-base font-bold leading-none text-[var(--color-gold)]">
            <AnimatedNumber value={warrant.price} className="tabular-nums" />
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</span>
        </span>
      </button>
      {canPledge &&
        (!isMe && warrant.kind === "warrant" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-[var(--color-red-team)] hover:bg-[var(--color-red-team)]/15 hover:text-[var(--color-red-team)]"
            aria-label={`Add to the bounty on ${warrant.target.name}`}
            onClick={() => onPledge(warrant)}
          >
            <PlusIcon aria-hidden />
          </Button>
        ) : (
          <span aria-hidden className="size-10 shrink-0" />
        ))}
    </motion.li>
  )
}
