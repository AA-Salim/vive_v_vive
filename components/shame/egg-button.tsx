"use client"

import { motion, useReducedMotion } from "motion/react"
import { EggFriedIcon, EggIcon } from "lucide-react"
import { PILLORY_COPY } from "@/lib/bounties/copy"
import { cn } from "@/lib/utils"

interface EggButtonProps {
  count: number
  thrown: boolean
  disabled: boolean
  disabledLabel?: string
  compact?: boolean
  targetName: string
  onThrow: () => void
}

export function EggButton({ count, thrown, disabled, disabledLabel, compact = false, targetName, onThrow }: EggButtonProps) {
  const reduce = useReducedMotion()
  const Icon = thrown ? EggFriedIcon : EggIcon
  const label = thrown ? `${PILLORY_COPY.eggDone}: you egged ${targetName}` : disabledLabel ?? `${PILLORY_COPY.egg} at ${targetName}`
  return (
    <button
      type="button"
      onClick={onThrow}
      disabled={disabled || thrown}
      aria-label={`${label}. ${count} ${count === 1 ? "egg" : "eggs"} so far.`}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-semibold tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50",
        compact ? "h-10 min-w-10 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
        thrown
          ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
          : "border-border bg-[var(--color-navy)]/60 text-[var(--color-gold-light)]/85 hover:border-[var(--color-gold)]/50 hover:text-[var(--color-gold-light)]",
        disabled && !thrown && "cursor-not-allowed opacity-50"
      )}
    >
      <motion.span
        key={thrown ? "splat" : "egg"}
        initial={reduce || !thrown ? false : { scale: 1.6, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="inline-flex"
      >
        <Icon className="size-4" aria-hidden />
      </motion.span>
      {!compact && <span>{thrown ? PILLORY_COPY.eggDone : "Egg"}</span>}
      <span aria-hidden>{count}</span>
    </button>
  )
}
