import { Skull, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PerkInfo } from "@/lib/titles/types"
import { TRIGGER_ICON } from "@/components/titles/title-visuals"

interface PerkLineProps {
  perk: PerkInfo | null
  className?: string
  emptyLabel?: string
}

export function PerkLine({ perk, className, emptyLabel = "Cosmetic only. No perk, just vibes." }: PerkLineProps) {
  if (!perk) {
    return <p className={cn("text-xs text-muted-foreground italic", className)}>{emptyLabel}</p>
  }
  const cursed = perk.kind === "curse"
  const Icon = cursed ? Skull : (TRIGGER_ICON[perk.trigger] ?? Sparkles)
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-snug",
        cursed ? "text-rose-100/90" : "text-[var(--color-gold-light)]/90",
        className
      )}
    >
      <Icon aria-hidden className={cn("mt-px size-3.5 shrink-0", cursed ? "text-rose-400" : "text-[var(--color-gold)]")} />
      <span>
        <span className="sr-only">{cursed ? "Curse: " : "Perk: "}</span>
        {perk.summary}
      </span>
    </p>
  )
}
