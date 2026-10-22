"use client"

import { LockIcon, ShieldIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { ownSideHelp } from "@/lib/betting/help"
import { formatMultiplier, sideLabel } from "@/lib/betting/math"
import { cn } from "@/lib/utils"
import type { Side } from "@/lib/types"

interface SidePickerProps {
  value: Side | null
  onChange: (side: Side) => void
  multipliers: Record<Side, number | null>
  lockedSide?: Side | null
  // The team the bettor plays for: the other side is closed to them.
  ownSide?: Side | null
  disabled?: boolean
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

function OwnSideNote({ side }: { side: Side }) {
  return (
    <p className="flex items-center gap-1.5 text-xs leading-snug text-muted-foreground">
      <ShieldIcon className={cn("size-3.5 shrink-0", STYLES[side].text)} aria-hidden />
      <span className="min-w-0">You play for {sideLabel(side)}: you can only bet on your own team.</span>
      <InfoTip help={ownSideHelp(side)} />
    </p>
  )
}

export function SidePicker({ value, onChange, multipliers, lockedSide = null, ownSide = null, disabled = false }: SidePickerProps) {
  if (lockedSide) {
    const style = STYLES[lockedSide]
    return (
      <div className="space-y-2">
        <div className={cn("flex h-12 items-center justify-between rounded-xl border px-4", style.active)}>
          <span className={cn("flex items-center gap-2 text-sm font-semibold", style.text)}>
            <LockIcon className="size-3.5" aria-hidden />
            Raising your {sideLabel(lockedSide)} bet
          </span>
          <span className={cn("font-display text-lg font-semibold tabular-nums", style.text)}>
            {formatMultiplier(multipliers[lockedSide])}
          </span>
        </div>
        {ownSide && <OwnSideNote side={ownSide} />}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Pick a side" className="grid grid-cols-2 gap-2">
        {(["blue", "red"] as const).map((side) => {
          const style = STYLES[side]
          const active = value === side
          const closed = !!ownSide && side !== ownSide
          return (
            <button
              key={side}
              type="button"
              aria-pressed={active}
              disabled={disabled || closed}
              onClick={() => onChange(side)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border bg-[var(--color-navy)]/60 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                active ? style.active : style.idle,
                closed && "border-dashed opacity-40 disabled:opacity-40"
              )}
            >
              <span className={cn("flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em]", style.text)}>
                {closed && <LockIcon className="size-3" aria-hidden />}
                {sideLabel(side)}
              </span>
              <span className={cn("font-display text-lg font-semibold tabular-nums leading-tight", style.text)}>
                {closed ? "Treason" : formatMultiplier(multipliers[side])}
              </span>
            </button>
          )
        })}
      </div>
      {ownSide && <OwnSideNote side={ownSide} />}
    </div>
  )
}
