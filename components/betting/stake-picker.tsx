"use client"

import { FlameIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { QUICK_STAKES } from "@/lib/betting/rules"
import { cn } from "@/lib/utils"

interface StakePickerProps {
  id: string
  label: string
  value: string
  onChange: (text: string) => void
  allIn: boolean
  onToggleAllIn: () => void
  allInEnabled: boolean
  allInStake: number
  purse: number | null
  maxAffordable: number
  sliderMax: number
  disabled?: boolean
}

const chip =
  "h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"

export function StakePicker({
  id,
  label,
  value,
  onChange,
  allIn,
  onToggleAllIn,
  allInEnabled,
  allInStake,
  purse,
  maxAffordable,
  sliderMax,
  disabled = false,
}: StakePickerProps) {
  const numeric = Number.parseInt(value, 10) || 0
  const sliderValue = Math.min(Math.max(allIn ? allInStake : numeric, 0), Math.max(sliderMax, 1))

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">
          {label}
        </Label>
        {purse != null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            Purse <span className={cn("font-semibold", purse < 0 ? "text-[var(--color-red-team)]" : "text-[var(--color-gold-light)]")}>{purse}</span>
          </span>
        )}
      </div>

      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="0"
          disabled={disabled}
          readOnly={allIn}
          value={allIn ? String(allInStake) : value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-12 bg-[var(--color-navy)]/70 pr-12 text-center font-display text-xl font-semibold tabular-nums text-[var(--color-gold-light)]"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">pts</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {QUICK_STAKES.map((stake) => (
          <button
            key={stake}
            type="button"
            disabled={disabled || stake > maxAffordable}
            aria-pressed={!allIn && numeric === stake}
            onClick={() => onChange(String(stake))}
            className={cn(
              chip,
              !allIn && numeric === stake
                ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
                : "border-border bg-[var(--color-navy)]/50 text-[var(--color-gold-light)]/80 hover:border-[var(--color-gold)]/50"
            )}
          >
            {stake}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || !allInEnabled}
          aria-pressed={allIn}
          onClick={onToggleAllIn}
          className={cn(
            chip,
            "flex items-center justify-center gap-1 text-xs",
            allIn
              ? "border-[var(--color-red-team)] bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
              : "border-[var(--color-red-team)]/35 bg-[var(--color-navy)]/50 text-[var(--color-red-team)]/90 hover:border-[var(--color-red-team)]/70"
          )}
        >
          <FlameIcon className="size-3.5" aria-hidden />
          All-in
        </button>
      </div>

      <Slider
        aria-label={`${label} slider`}
        min={0}
        max={Math.max(sliderMax, 1)}
        step={1}
        value={[sliderValue]}
        disabled={disabled || sliderMax < 1 || allIn}
        onValueChange={(next) => {
          const v = Array.isArray(next) ? next[0] : (next as number)
          onChange(v > 0 ? String(v) : "")
        }}
        className="py-2"
      />
    </div>
  )
}
