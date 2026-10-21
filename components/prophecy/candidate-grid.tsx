"use client"

import type { ReactNode } from "react"
import { motion } from "motion/react"
import { CheckIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionPortrait } from "@/components/prophecy/champion-portrait"
import { TONES } from "@/components/prophecy/category-meta"
import type { Category } from "@/lib/prophecy/constants"
import type { Candidate } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

interface CandidateGridProps {
  candidates: Candidate[]
  category: Category
  label: string
  selectedId?: string | null
  highlightIds?: string[]
  onSelect?: (playerId: string) => void
  disabledReason?: (candidate: Candidate) => string | null
  aside?: (candidate: Candidate) => ReactNode
  share?: (candidate: Candidate) => number
  describe?: (candidate: Candidate) => string
}

const SIDES = [
  { side: "blue", label: "Blue side", text: "text-[var(--color-blue-team)]" },
  { side: "red", label: "Red side", text: "text-[var(--color-red-team)]" },
] as const

export function CandidateGrid({
  candidates,
  category,
  label,
  selectedId,
  highlightIds,
  onSelect,
  disabledReason,
  aside,
  share,
  describe,
}: CandidateGridProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2 sm:gap-3">
      {SIDES.map(({ side, label: sideLabel, text }) => (
        <div key={side} className="min-w-0 space-y-1.5">
          <div className={cn("flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em]", text)}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {sideLabel}
          </div>
          {candidates
            .filter((c) => c.side === side)
            .map((candidate) => (
              <CandidateTile
                key={candidate.playerId}
                candidate={candidate}
                category={category}
                selected={selectedId === candidate.playerId}
                highlighted={!!highlightIds?.includes(candidate.playerId)}
                interactive={!!onSelect}
                reason={disabledReason?.(candidate) ?? null}
                aside={aside?.(candidate)}
                share={share?.(candidate)}
                description={describe?.(candidate)}
                onSelect={onSelect}
              />
            ))}
        </div>
      ))}
    </div>
  )
}

interface CandidateTileProps {
  candidate: Candidate
  category: Category
  selected: boolean
  highlighted: boolean
  interactive: boolean
  reason: string | null
  aside?: ReactNode
  share?: number
  description?: string
  onSelect?: (playerId: string) => void
}

function CandidateTile({
  candidate,
  category,
  selected,
  highlighted,
  interactive,
  reason,
  aside,
  share,
  description,
  onSelect,
}: CandidateTileProps) {
  const tone = TONES[category]
  const disabled = !interactive || !!reason
  const body = (
    <>
      {share !== undefined && (
        <motion.span
          aria-hidden
          className={cn("pointer-events-none absolute inset-y-0 left-0 opacity-[0.16]", tone.fill)}
          initial={false}
          animate={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
      )}
      <span className="relative">
        <ChampionPortrait
          championInternal={candidate.championInternal}
          champion={candidate.champion}
          side={candidate.side}
          size="md"
        />
        {selected && (
          <span
            aria-hidden
            className={cn(
              "absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-[var(--color-navy)]",
              tone.fill
            )}
          >
            <CheckIcon className="size-3 text-[var(--color-navy)]" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm leading-tight font-semibold text-foreground">{candidate.name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-tight text-muted-foreground">
          {reason ? (
            <span className="truncate font-medium italic">{reason}</span>
          ) : (
            <>
              <LaneIcon lane={candidate.lane} size={11} className="shrink-0 opacity-70" />
              <span className="truncate">{candidate.champion}</span>
            </>
          )}
        </span>
      </span>
      {aside !== undefined && <span className="relative shrink-0 text-right">{aside}</span>}
    </>
  )

  const classes = cn(
    "relative flex min-h-14 w-full items-center gap-2 overflow-hidden rounded-lg border px-2 py-2 sm:gap-2.5 sm:px-2.5 text-left transition-[border-color,background-color,opacity]",
    "bg-[var(--color-navy)]/70",
    selected ? tone.selected : highlighted ? tone.border : "border-border",
    interactive && !reason && !selected && "hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-navy-lighter)]/70",
    reason && "opacity-55"
  )

  if (!interactive) {
    return (
      <div className={classes}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={description && reason ? `${description} Unavailable: ${reason}.` : description}
      disabled={disabled}
      onClick={() => onSelect?.(candidate.playerId)}
      className={cn(
        classes,
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-navy)]",
        disabled ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
      )}
    >
      {body}
    </button>
  )
}
