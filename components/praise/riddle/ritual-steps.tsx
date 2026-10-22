import { CheckIcon } from "lucide-react"
import { RIDDLE_COPY } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

const STEPS = [RIDDLE_COPY.stepOne, RIDDLE_COPY.stepTwo]

// The two-step hand kiss: 1. the King's Riddle, 2. the written praise.
export function RitualSteps({ step }: { step: 1 | 2 }) {
  return (
    <ol aria-label={`Step ${step} of 2`} className="grid grid-cols-2 gap-2 pr-9">
      {STEPS.map((label, index) => {
        const position = index + 1
        const done = position < step
        const current = position === step
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="min-w-0">
            <div
              aria-hidden
              className={cn(
                "h-1 rounded-full transition-colors duration-300",
                done || current ? "bg-[var(--color-gold)]" : "bg-[var(--color-gold)]/15"
              )}
            />
            <p
              className={cn(
                "mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase",
                current ? "text-[var(--color-gold)]" : done ? "text-[var(--color-gold)]/70" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] tracking-normal",
                  done
                    ? "bg-[var(--color-gold)] text-[var(--color-navy)]"
                    : current
                      ? "border border-[var(--color-gold)] text-[var(--color-gold)]"
                      : "border border-border"
                )}
              >
                {done ? <CheckIcon className="size-2.5" strokeWidth={3} aria-hidden /> : position}
              </span>
              <span className="truncate">{label}</span>
              <span className="sr-only">{done ? " (done)" : current ? " (current)" : ""}</span>
            </p>
          </li>
        )
      })}
    </ol>
  )
}
