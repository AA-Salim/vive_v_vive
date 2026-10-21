"use client"

import { motion, useReducedMotion } from "motion/react"
import { CoinsIcon, CrosshairIcon, LockIcon } from "lucide-react"
import { TARGETING_LABELS, TIER_LABELS, type DecreeDef, type DecreeType } from "@/lib/chaos/catalog"
import type { DecreeBlock } from "@/lib/chaos/rules"
import { cn } from "@/lib/utils"
import { DecreeIcon } from "@/components/chaos/decree-icon"
import { TIER_STYLES } from "@/components/chaos/tier-styles"

export interface DecreeCardModel {
  def: DecreeDef
  cost: number
  used: number
  max: number
  block: DecreeBlock | null
  debt: boolean
}

interface DecreeCardProps extends DecreeCardModel {
  index: number
  onSelect: (type: DecreeType) => void
}

function statusLabel({ block, used, max, debt }: Pick<DecreeCardModel, "block" | "used" | "max" | "debt">) {
  if (block) return block.label
  if (debt) return "Puts you in debt"
  if (max > 1) return `${used} of ${max} used`
  return "Ready"
}

export function DecreeCard({ def, cost, used, max, block, debt, index, onSelect }: DecreeCardProps) {
  const reduceMotion = useReducedMotion()
  const style = TIER_STYLES[def.tier]
  const disabled = !!block
  const statusId = `decree-status-${def.type}`

  return (
    <motion.button
      type="button"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.03 }}
      whileHover={disabled || reduceMotion ? undefined : { y: -2 }}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.98 }}
      onClick={() => onSelect(def.type)}
      disabled={disabled}
      aria-describedby={statusId}
      className={cn(
        "group relative flex min-h-[172px] w-full flex-col rounded-xl border bg-linear-to-b to-transparent p-3 text-left",
        "bg-[var(--color-navy)]/70 outline-none transition-colors focus-visible:ring-2",
        style.border,
        style.wash,
        style.focus,
        disabled
          ? "cursor-not-allowed opacity-55 saturate-[0.6]"
          : "hover:bg-[var(--color-navy-light)] hover:shadow-[0_0_24px_-12px_currentColor]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-[var(--color-navy)]/80",
            style.border,
            style.text
          )}
        >
          <DecreeIcon type={def.type} className="size-[18px]" />
        </span>
        <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", style.chip)}>
          {TIER_LABELS[def.tier]}
        </span>
      </div>

      <span className="mt-3 font-display text-[15px] font-semibold leading-tight text-[var(--color-gold-light)]">
        {def.name}
      </span>
      <span className="mt-1 text-xs leading-snug text-[var(--color-gold-light)]/60">{def.short}</span>
      <span className="mt-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-gold-light)]/40">
        <CrosshairIcon aria-hidden className="size-3" />
        <span className="sr-only">Target: </span>
        {TARGETING_LABELS[def.targeting]}
      </span>

      <span className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-[var(--color-gold)]">
          <CoinsIcon aria-hidden className="size-3.5" />
          {cost}
          <span className="sr-only"> points</span>
        </span>
        <span
          id={statusId}
          className={cn(
            "flex items-center gap-1 text-right text-[11px] leading-tight",
            block ? "text-[var(--color-gold-light)]/55" : debt ? "text-amber-300" : style.text
          )}
        >
          {block && <LockIcon aria-hidden className="size-3 shrink-0" />}
          {statusLabel({ block, used, max, debt })}
        </span>
      </span>
    </motion.button>
  )
}
