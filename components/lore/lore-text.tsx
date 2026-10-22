import type { LoreMark, LoreSegment } from "@/lib/lore/segments"
import { cn } from "@/lib/utils"

const MARK_CLASS: Record<LoreMark, string> = {
  name: "font-semibold text-[var(--color-gold-light)]",
  salaxe: "font-semibold text-[var(--color-gold)]",
  num: "font-semibold text-foreground tabular-nums",
  blue: "font-semibold text-[var(--color-blue-team)]",
  red: "font-semibold text-[var(--color-red-team)]",
  title: "italic text-[var(--color-gold-light)]",
}

export function LoreText({ segments, className }: { segments: LoreSegment[]; className?: string }) {
  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.mark ? (
          <span key={i} className={cn(MARK_CLASS[segment.mark])}>
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </span>
  )
}
