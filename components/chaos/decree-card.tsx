"use client"

import { motion, useReducedMotion } from "motion/react"
import { CoinsIcon, CrosshairIcon, LockIcon } from "lucide-react"
import { TARGETING_LABELS, TIER_LABELS, type DecreeDef, type DecreeType } from "@/lib/chaos/catalog"
import type { DecreeBlock } from "@/lib/chaos/rules"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"
import { InfoTip } from "@/components/ui/info-tip"
import { DecreeIcon } from "@/components/chaos/decree-icon"
import { TitleChipRow, type TitleChipModel } from "@/components/chaos/title-chips"
import { TIER_STYLES } from "@/components/chaos/tier-styles"

export interface DecreeCardModel {
  def: DecreeDef
  cost: number
  baseCost: number
  used: number
  max: number
  block: DecreeBlock | null
  debt: boolean
  help: HelpEntry | null
  titleChips: TitleChipModel[]
  titleHelp: HelpEntry | null
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

// The whole card is one stretched button; the info bubble sits above it so it still opens on disabled cards.
export function DecreeCard({ def, cost, baseCost, used, max, block, debt, help, titleChips, titleHelp, index, onSelect }: DecreeCardProps) {
  const reduceMotion = useReducedMotion()
  const style = TIER_STYLES[def.tier]
  const disabled = !!block
  const statusId = `decree-status-${def.type}`
  const detailsId = `decree-details-${def.type}`
  const repriced = cost !== baseCost

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.03 }}
      whileHover={disabled || reduceMotion ? undefined : { y: -2 }}
      className={cn(
        "group relative flex min-h-[172px] w-full flex-col rounded-xl border bg-linear-to-b to-transparent p-3 text-left",
        "bg-[var(--color-navy)]/70 transition-[background-color,box-shadow,scale] has-[>button:focus-visible]:ring-2",
        style.border,
        style.wash,
        style.ring,
        disabled
          ? "opacity-55 saturate-[0.6]"
          : "hover:bg-[var(--color-navy-light)] hover:shadow-[0_0_24px_-12px_currentColor] has-[>button:active]:scale-[0.98] motion-reduce:has-[>button:active]:scale-100",
        titleChips.length > 0 && !disabled && "ring-1 ring-emerald-400/20"
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

      <button
        type="button"
        onClick={() => onSelect(def.type)}
        disabled={disabled}
        aria-describedby={`${detailsId} ${statusId}`}
        className="mt-3 text-left font-display text-[15px] font-semibold leading-tight text-[var(--color-gold-light)] outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] disabled:cursor-not-allowed"
      >
        {def.name}
      </button>
      <span id={detailsId} className="mt-1 text-xs leading-snug text-[var(--color-gold-light)]/60">
        {def.short}
        <span className="sr-only">
          {" "}
          Target: {TARGETING_LABELS[def.targeting]}. Costs {cost} points{repriced ? ` instead of ${baseCost}, thanks to your titles` : ""}.
        </span>
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-0.5">
        <span aria-hidden className="flex min-w-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-gold-light)]/40">
          <CrosshairIcon className="size-3 shrink-0" />
          <span className="truncate">{TARGETING_LABELS[def.targeting]}</span>
        </span>
        {help && <InfoTip help={help} side="top" className="z-10 -my-1 -mr-2 [&_svg]:size-3.5" />}
      </span>

      {titleChips.length > 0 && (
        <TitleChipRow
          chips={titleChips}
          help={titleHelp ?? undefined}
          size="xs"
          className="relative z-10 mt-2"
          label={`Title effects on ${def.name}`}
        />
      )}

      <span className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span aria-hidden className="flex items-center gap-1 text-sm font-bold tabular-nums text-[var(--color-gold)]">
          <CoinsIcon className="size-3.5" />
          {repriced && <s className="text-xs font-medium text-[var(--color-gold-light)]/40">{baseCost}</s>}
          <span className={cn(repriced && (cost < baseCost ? "text-emerald-300" : "text-rose-300"))}>{cost}</span>
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
    </motion.div>
  )
}
