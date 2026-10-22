import { CheckIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { PHASE_COPY, type RoomPhase } from "@/components/session/copy"
import { PHASE_HELP } from "@/components/session/help"
import { cn } from "@/lib/utils"

const STEPS: RoomPhase[] = ["draft", "chaos", "betting", "in_game", "result"]

// Every step opens its own bubble: tap a pill to see what happens in that phase.
export function PhaseStepper({ phase, coachMode = false }: { phase: RoomPhase; coachMode?: boolean }) {
  const steps: RoomPhase[] = coachMode ? ["coach_draft", ...STEPS] : STEPS
  const current = steps.indexOf(phase)

  return (
    <ol aria-label="Game progress" className="flex min-w-0 items-center gap-1 sm:gap-1.5">
      {steps.map((step, i) => {
        const status = i < current ? "done" : i === current ? "current" : "todo"
        return (
          <li key={step} className="flex min-w-0 items-center gap-1 sm:gap-1.5" aria-current={status === "current" ? "step" : undefined}>
            <InfoTip help={PHASE_HELP[step]} side="bottom" className="size-auto">
              <span
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  status === "current" && "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
                  status === "done" && "border-transparent text-[var(--color-gold-light)]/70 hover:border-border",
                  status === "todo" && "border-transparent text-muted-foreground/70 hover:border-border"
                )}
              >
                {status === "done" ? (
                  <CheckIcon className="size-3.5 text-[var(--color-gold)]" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      status === "current" ? "animate-pulse bg-[var(--color-gold)]" : "bg-muted-foreground/50"
                    )}
                  />
                )}
                <span className={cn(status !== "current" && "sr-only md:not-sr-only")}>{PHASE_COPY[step].label}</span>
              </span>
            </InfoTip>
            <span className="sr-only">{status === "done" ? " (done)" : status === "todo" ? " (upcoming)" : " (now)"}</span>
            {i < steps.length - 1 && (
              <span aria-hidden className={cn("h-px w-2 sm:w-4", i < current ? "bg-[var(--color-gold)]/60" : "bg-border")} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
