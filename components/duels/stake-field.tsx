"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { DUEL_RULES, canAfford } from "@/lib/duels/rules"
import { cn } from "@/lib/utils"

interface StakeFieldProps {
  value: string
  onChange: (text: string) => void
  balance: number | null
  disabled?: boolean
}

const chip =
  "h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35"

export function StakeField({ value, onChange, balance, disabled = false }: StakeFieldProps) {
  const id = useId()
  const hintId = useId()
  const numeric = Number.parseInt(value, 10) || 0

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">
          The price of honor
        </label>
        {balance !== null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            Purse{" "}
            <span className={cn("font-semibold", balance < 0 ? "text-[var(--color-red-team)]" : "text-[var(--color-gold-light)]")}>
              {balance}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {DUEL_RULES.stakeChips.map((stake) => (
          <button
            key={stake}
            type="button"
            disabled={disabled || (balance !== null && !canAfford(balance, stake))}
            aria-pressed={numeric === stake}
            onClick={() => onChange(String(stake))}
            className={cn(
              chip,
              numeric === stake
                ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
                : "border-border bg-[var(--color-navy)]/50 text-[var(--color-gold-light)]/80 hover:border-[var(--color-gold)]/50"
            )}
          >
            {stake}
          </button>
        ))}
      </div>

      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder={String(DUEL_RULES.minStake)}
          disabled={disabled}
          value={value}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
          className="h-12 bg-[var(--color-navy)]/70 pr-12 text-center font-display text-xl font-semibold tabular-nums text-[var(--color-gold-light)]"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">pts</span>
      </div>
      <p id={hintId} className="text-[11px] text-muted-foreground">
        Each side puts up the same stake, {DUEL_RULES.minStake} to {DUEL_RULES.maxStake} points.
      </p>
    </div>
  )
}
