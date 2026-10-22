"use client"

import { DicesIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import type { PilloryPreview, ShameStat, ShameStatKey } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface RoastPickerProps {
  id: string
  preview: PilloryPreview | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  statKey: ShameStatKey | null
  onStatChange: (key: ShameStatKey) => void
  suggestions: string[]
  message: string
  onMessageChange: (text: string) => void
  onShuffle: () => void
  disabled?: boolean
}

const option =
  "w-full rounded-xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50"

export function RoastPicker({
  id,
  preview,
  loading,
  error,
  onRetry,
  statKey,
  onStatChange,
  suggestions,
  message,
  onMessageChange,
  onShuffle,
  disabled = false,
}: RoastPickerProps) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Digging through their record">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    )
  }
  if (error || !preview) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        The scribes could not read their record.
        <Button type="button" variant="outline" className="h-10" onClick={onRetry}>
          <RotateCcwIcon aria-hidden />
          Retry
        </Button>
      </div>
    )
  }

  const stats: ShameStat[] = [preview.stat, ...preview.alternatives]
  const active = stats.find((s) => s.key === statKey) ?? preview.stat
  const trimmed = message.trim()

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">Their worst stat</legend>
        <div role="radiogroup" aria-label="Their worst stat" className="grid gap-1.5 sm:grid-cols-2">
          {stats.map((stat) => {
            const selected = stat.key === active.key
            return (
              <button
                key={stat.key}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onStatChange(stat.key)}
                className={cn(
                  option,
                  "min-h-12",
                  selected
                    ? "border-[var(--color-red-team)]/60 bg-[var(--color-red-team)]/15"
                    : "border-border bg-[var(--color-navy)]/50 hover:border-[var(--color-red-team)]/40"
                )}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-red-team)]/90">{stat.label}</span>
                <span className="block truncate font-display text-sm font-semibold text-[var(--color-gold-light)]">{stat.value}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">Pick a roast</legend>
          <Button type="button" variant="ghost" className="h-10 text-xs" onClick={onShuffle} disabled={disabled}>
            <DicesIcon aria-hidden />
            Another
          </Button>
        </div>
        <div role="radiogroup" aria-label="Pick a roast" className="space-y-1.5">
          {suggestions.map((line) => {
            const selected = trimmed === line
            return (
              <button
                key={line}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onMessageChange(line)}
                className={cn(
                  option,
                  "min-h-11 text-[13px] leading-snug",
                  selected
                    ? "border-[var(--color-gold)]/60 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)]"
                    : "border-border bg-[var(--color-navy)]/50 text-[var(--color-gold-light)]/80 hover:border-[var(--color-gold)]/40"
                )}
              >
                {line}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={`${id}-message`} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">
            Or write your own
          </label>
          <span className={cn("text-[11px] tabular-nums", message.length > PILLORY_RULES.messageMax ? "text-[var(--color-red-team)]" : "text-muted-foreground")}>
            {message.length}/{PILLORY_RULES.messageMax}
          </span>
        </div>
        <Textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => onMessageChange(e.target.value.slice(0, PILLORY_RULES.messageMax + 20))}
          rows={2}
          disabled={disabled}
          placeholder="Short, specific, affectionate. Nothing about real life."
          className="min-h-16 bg-[var(--color-navy)]/70 text-sm"
        />
      </div>
    </div>
  )
}
