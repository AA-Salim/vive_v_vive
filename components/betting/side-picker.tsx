"use client"

import { LockIcon } from "lucide-react"
import { formatMultiplier, sideLabel } from "@/lib/betting/math"
import { cn } from "@/lib/utils"
import type { Side } from "@/lib/types"

interface SidePickerProps {
  value: Side | null
  onChange: (side: Side) => void
  multipliers: Record<Side, number | null>
  lockedSide?: Side | null
  disabled?: boolean
  // Why a side cannot be picked (e.g. a seated player restricted to their own team). Nothing sets it yet.
  blocked?: Partial<Record<Side, string>>
}

const STYLES: Record<Side, { idle: string; active: string; text: string }> = {
  blue: {
    idle: "border-[var(--color-blue-team)]/30 hover:border-[var(--color-blue-team)]/60 hover:bg-[var(--color-blue-team)]/10",
    active: "border-[var(--color-blue-team)] bg-[var(--color-blue-team)]/20 shadow-[0_0_24px_-6px_var(--color-blue-team)]",
    text: "text-[var(--color-blue-team)]",
  },
  red: {
    idle: "border-[var(--color-red-team)]/30 hover:border-[var(--color-red-team)]/60 hover:bg-[var(--color-red-team)]/10",
    active: "border-[var(--color-red-team)] bg-[var(--color-red-team)]/20 shadow-[0_0_24px_-6px_var(--color-red-team)]",
    text: "text-[var(--color-red-team)]",
  },
}

export function SidePicker({ value, onChange, multipliers, lockedSide = null, disabled = false, blocked }: SidePickerProps) {
  if (lockedSide) {
    const style = STYLES[lockedSide]
    return (
      <div className={cn("flex h-12 items-center justify-between rounded-xl border px-4", style.active)}>
        <span className={cn("flex items-center gap-2 text-sm font-semibold", style.text)}>
          <LockIcon className="size-3.5" aria-hidden />
          Raising your {sideLabel(lockedSide)} bet
        </span>
        <span className={cn("font-display text-lg font-semibold tabular-nums", style.text)}>
          {formatMultiplier(multipliers[lockedSide])}
        </span>
      </div>
    )
  }

  const reasons = (["blue", "red"] as const).flatMap((side) => blocked?.[side] ?? [])

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Pick a side" className="grid grid-cols-2 gap-2">
        {(["blue", "red"] as const).map((side) => {
          const style = STYLES[side]
          const active = value === side
          return (
            <button
              key={side}
              type="button"
              aria-pressed={active}
              disabled={disabled || !!blocked?.[side]}
              onClick={() => onChange(side)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border bg-[var(--color-navy)]/60 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                active ? style.active : style.idle
              )}
            >
              <span className={cn("text-xs font-semibold uppercase tracking-[0.2em]", style.text)}>{sideLabel(side)}</span>
              <span className={cn("font-display text-lg font-semibold tabular-nums leading-tight", style.text)}>
                {formatMultiplier(multipliers[side])}
              </span>
            </button>
          )
        })}
      </div>
      {reasons.map((reason) => (
        <p key={reason} className="text-center text-xs text-muted-foreground">
          {reason}
        </p>
      ))}
    </div>
  )
}
