"use client"

import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, HourglassIcon, LockIcon, RotateCcwIcon, TimerIcon, ZapIcon } from "lucide-react"
import { formatClock, type MarketClock } from "@/components/betting/use-clock"
import { MARKET_COPY } from "@/lib/betting/copy"
import { BET_RULES } from "@/lib/betting/rules"
import type { RulesVersion } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

export type MarketPhase = "open" | "closing" | "locked" | "settled" | "refunded"

interface MarketHeaderProps {
  phase: MarketPhase
  clock: MarketClock
  rulesVersion: RulesVersion
}

function PhaseChip({ phase, clock }: { phase: MarketPhase; clock: MarketClock }) {
  const base = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tabular-nums"
  if (phase === "open" && clock.remainingMs != null) {
    return (
      <span
        className={cn(
          base,
          clock.isLastCall
            ? "border-[var(--color-red-team)]/50 bg-[var(--color-red-team)]/15 text-[var(--color-red-team)] motion-safe:animate-pulse"
            : "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
        )}
        aria-label={`Betting closes in ${formatClock(clock.remainingMs)}`}
      >
        <TimerIcon className="size-3.5" aria-hidden />
        {formatClock(clock.remainingMs)}
      </span>
    )
  }
  const chips = {
    open: { icon: TimerIcon, label: "Open" },
    closing: { icon: HourglassIcon, label: "Closing" },
    locked: { icon: LockIcon, label: "Locked" },
    settled: { icon: CheckIcon, label: "Settled" },
    refunded: { icon: RotateCcwIcon, label: "Refunded" },
  } as const
  const { icon: Icon, label } = chips[phase]
  return (
    <span className={cn(base, "border-border bg-muted/60 text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

const bannerMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.25 },
}

export function MarketHeader({ phase, clock, rulesVersion }: MarketHeaderProps) {
  const subtitle =
    phase === "locked" ? MARKET_COPY.locked : phase === "closing" ? MARKET_COPY.closing : MARKET_COPY.subtitle
  const showEarly = phase === "open" && rulesVersion === 2 && clock.isEarly
  const showLastCall = phase === "open" && clock.isLastCall && clock.remainingMs != null

  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="royal-wagers-title" className="font-display text-lg font-semibold tracking-wide text-[var(--color-gold)]">
            {MARKET_COPY.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <PhaseChip phase={phase} clock={clock} />
      </div>

      <AnimatePresence initial={false}>
        {showEarly && (
          <motion.div key="early" {...bannerMotion} className="overflow-hidden">
            <div className="rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[var(--color-gold)]">
                  <ZapIcon className="size-3.5 shrink-0" aria-hidden />
                  {MARKET_COPY.earlyTitle}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-gold-light)]/80">
                  {formatClock(clock.earlyRemainingMs)} left
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--color-gold-light)]/70">{MARKET_COPY.earlyHint}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-navy)]">
                <div
                  className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500 ease-linear"
                  style={{ width: `${Math.min(100, (clock.earlyRemainingMs / (BET_RULES.earlySeconds * 1000)) * 100)}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
        {showLastCall && (
          <motion.div key="last-call" {...bannerMotion} className="overflow-hidden">
            <div
              role="status"
              className="rounded-lg border border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/10 px-3 py-2 text-xs font-semibold text-[var(--color-red-team)]"
            >
              <span className="sr-only">
                {MARKET_COPY.lastCall}: betting closes in under {BET_RULES.lastCallSeconds} seconds.
              </span>
              <span aria-hidden>
                {MARKET_COPY.lastCall}. The notebook slams shut in {formatClock(clock.remainingMs ?? 0)}.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
