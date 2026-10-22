import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TitleEffectLine } from "@/lib/titles/effects"

interface EffectLinesProps {
  effects: readonly TitleEffectLine[]
  cursed?: boolean
  className?: string
  emptyLabel?: string | null
}

export function EffectLines({ effects, cursed = false, className, emptyLabel = "No immediate effect." }: EffectLinesProps) {
  if (effects.length === 0) {
    return emptyLabel ? <p className={cn("text-xs text-muted-foreground italic", className)}>{emptyLabel}</p> : null
  }
  return (
    <ul className={cn("space-y-1", className)}>
      {effects.map((effect) => (
        <li
          key={effect.key}
          className={cn(
            "flex items-start gap-2 text-xs leading-snug",
            cursed ? "text-rose-100/90" : "text-[var(--color-gold-light)]/90"
          )}
        >
          <Zap aria-hidden className={cn("mt-px size-3.5 shrink-0", cursed ? "text-rose-400" : "text-amber-300")} />
          <span>
            <span className="sr-only">{cursed ? "Curse effect: " : "Effect: "}</span>
            {effect.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface EffectBoxProps {
  label: string
  cursed?: boolean
  className?: string
  children: React.ReactNode
}

// A labeled box: "While equipped" for immediate effects, "After each game" for perks.
export function EffectBox({ label, cursed = false, className, children }: EffectBoxProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        cursed ? "border-rose-500/25 bg-rose-500/[0.06]" : "border-[var(--color-gold)]/15 bg-[var(--color-gold)]/[0.04]",
        className
      )}
    >
      <p className={cn("mb-1 text-[10px] font-bold tracking-wider uppercase", cursed ? "text-rose-300" : "text-[var(--color-gold)]/80")}>
        {label}
      </p>
      {children}
    </div>
  )
}
