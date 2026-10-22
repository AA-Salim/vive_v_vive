"use client"

import { LockIcon, ShieldIcon } from "lucide-react"
import { SIDE_NAME } from "@/lib/duels/rules"
import { DUEL_COPY } from "@/lib/duels/copy"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const STYLES: Record<Side, { idle: string; active: string; text: string }> = {
  blue: {
    idle: "border-[var(--color-blue-team)]/30 hover:border-[var(--color-blue-team)]/60 hover:bg-[var(--color-blue-team)]/10",
    active: "border-[var(--color-blue-team)] bg-[var(--color-blue-team)]/20 shadow-[0_0_24px_-8px_var(--color-blue-team)]",
    text: "text-[var(--color-blue-team)]",
  },
  red: {
    idle: "border-[var(--color-red-team)]/30 hover:border-[var(--color-red-team)]/60 hover:bg-[var(--color-red-team)]/10",
    active: "border-[var(--color-red-team)] bg-[var(--color-red-team)]/20 shadow-[0_0_24px_-8px_var(--color-red-team)]",
    text: "text-[var(--color-red-team)]",
  },
}

interface BannerPickerProps {
  value: Side
  onChange: (side: Side) => void
  lockedSide: Side | null
  disabled?: boolean
}

export function BannerPicker({ value, onChange, lockedSide, disabled = false }: BannerPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">Your banner</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["blue", "red"] as const).map((side) => {
          const style = STYLES[side]
          const active = value === side
          const forbidden = lockedSide !== null && lockedSide !== side
          return (
            <button
              key={side}
              type="button"
              aria-pressed={active}
              disabled={disabled || forbidden}
              onClick={() => onChange(side)}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-xl border bg-[var(--color-navy)]/60 text-sm font-semibold uppercase tracking-[0.16em] transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none",
                active ? style.active : style.idle,
                forbidden && "opacity-35",
                style.text
              )}
            >
              {forbidden ? <LockIcon className="size-4" aria-hidden /> : <ShieldIcon className="size-4" aria-hidden />}
              {SIDE_NAME[side]}
            </button>
          )
        })}
      </div>
      {lockedSide && <p className="text-[11px] leading-relaxed text-muted-foreground">{DUEL_COPY.treason}</p>}
    </fieldset>
  )
}
