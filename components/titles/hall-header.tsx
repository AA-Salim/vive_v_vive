"use client"

import { Coins } from "lucide-react"
import { useAct } from "@/hooks/use-act"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { PerksExplainer } from "@/components/titles/perks-explainer"
import { cn } from "@/lib/utils"
import { HALL_COPY } from "@/lib/titles/copy"

interface HallHeaderProps {
  balance: number | null
  signedIn: boolean
}

export function HallHeader({ balance, signedIn }: HallHeaderProps) {
  const { act } = useAct()

  return (
    <header className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-5 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--color-gold)_16%,transparent),transparent_65%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/60 to-transparent" />
      <div className="relative">
        {act && (
          <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--color-gold)]/70 uppercase">
            Act {act.act_number}
            {act.subtitle ? ` · ${act.subtitle}` : ""}
          </p>
        )}
        <h1 className="font-display mt-1 text-3xl leading-tight text-[var(--color-gold)] sm:text-4xl">{HALL_COPY.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-gold-light)]/70">{HALL_COPY.tagline}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {signedIn && balance !== null && (
            <span
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold",
                balance < 0 ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)]"
              )}
            >
              <Coins aria-hidden className="size-4 text-[var(--color-gold)]" />
              <AnimatedNumber value={balance} />
              <span className="text-xs font-normal text-muted-foreground">points</span>
            </span>
          )}
          <PerksExplainer />
        </div>
      </div>
    </header>
  )
}
