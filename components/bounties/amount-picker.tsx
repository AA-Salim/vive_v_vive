"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QUICK_PLEDGES } from "@/lib/bounties/rules"
import { cn } from "@/lib/utils"

interface AmountPickerProps {
  id: string
  value: string
  onChange: (text: string) => void
  purse: number | null
  max: number
  disabled?: boolean
}

const chip =
  "h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"

export function AmountPicker({ id, value, onChange, purse, max, disabled = false }: AmountPickerProps) {
  const numeric = Number.parseInt(value, 10) || 0
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">
          Price on the head
        </Label>
        {purse != null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            Purse{" "}
            <span className={cn("font-semibold", purse < 0 ? "text-[var(--color-red-team)]" : "text-[var(--color-gold-light)]")}>{purse}</span>
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
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
          className="h-12 bg-[var(--color-navy)]/70 pr-12 text-center font-display text-xl font-semibold tabular-nums text-[var(--color-gold-light)]"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">pts</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_PLEDGES.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled || amount > max}
            aria-pressed={numeric === amount}
            onClick={() => onChange(String(amount))}
            className={cn(
              chip,
              numeric === amount
                ? "border-[var(--color-red-team)] bg-[var(--color-red-team)]/15 text-[var(--color-gold-light)]"
                : "border-border bg-[var(--color-navy)]/50 text-[var(--color-gold-light)]/80 hover:border-[var(--color-red-team)]/50"
            )}
          >
            {amount}
          </button>
        ))}
      </div>
    </div>
  )
}
