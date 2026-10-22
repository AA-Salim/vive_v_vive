"use client"

import { useState } from "react"
import { HandHeartIcon } from "lucide-react"
import { ComposerDialog } from "@/components/praise/composer-dialog"
import { PraiseCountdown } from "@/components/praise/praise-countdown"
import { usePraiseTerms } from "@/components/praise/title-bonus"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { useAuthUser } from "@/hooks/use-auth"
import { usePraiseState } from "@/hooks/use-praise"
import { kissReward, PRAISE_RULES } from "@/lib/praise/rules"
import { COPY } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

const SHELL =
  "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60"

// The header's way to kiss the hand: the kisses left today on a badge, opening the same riddle and composer as the
// daily popup. Dimmed with the reset time once every kiss of the day is given; hidden when signed out.
export function HeaderKiss() {
  const { user } = useAuthUser()
  const userId = user?.id ?? null
  const praise = usePraiseState(userId, !!userId)
  const [composer, setComposer] = useState<{ seed: number; open: boolean } | null>(null)
  const state = praise.data?.state.available ? praise.data.state : null
  const me = state?.me ?? null
  const rules = state?.rules ?? PRAISE_RULES
  const next = usePraiseTerms(me?.nextReward ?? kissReward(rules, me?.nextSlot ?? 1))

  if (!userId || !state || !me) return null

  const left = me.remainingToday
  return (
    <>
      {me.canSing ? (
        <button
          type="button"
          onClick={() => setComposer({ seed: Math.floor(Math.random() * 1_000_000), open: true })}
          aria-label={`Kiss the hand: ${COPY.leftToday(left)}, next pays +${next.reward}`}
          title={`Kiss the hand (+${next.reward})`}
          className={cn(SHELL, "border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)] hover:border-[var(--color-gold)]/60 hover:bg-[var(--color-gold)]/15")}
        >
          <HandHeartIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
          <span className="hidden xl:inline">Kiss the hand</span>
          <span className="min-w-4 rounded-full bg-[var(--color-gold)] px-1 text-center text-[11px] leading-4 text-[var(--color-navy)] tabular-nums" aria-hidden>
            {left}
          </span>
        </button>
      ) : (
        <Popover>
          <PopoverTrigger
            aria-label={`${COPY.comeBack} Every kiss of the day is given.`}
            className={cn(SHELL, "border-border bg-[var(--color-navy)]/40 text-muted-foreground opacity-60 hover:opacity-90")}
          >
            <HandHeartIcon className="size-4" aria-hidden />
            <span className="hidden xl:inline">{COPY.comeBack}</span>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-72 gap-1.5">
            <PopoverTitle className="font-display text-sm">{COPY.comeBack}</PopoverTitle>
            <PopoverDescription className="text-xs leading-relaxed">
              {rules.perDay > 1 ? `${COPY.allKissed(rules.perDay)} ` : null}
              {COPY.nextSong}{" "}
              <PraiseCountdown
                target={state.resetsAt}
                clockOffset={praise.data?.clockOffset ?? 0}
                className="font-semibold tabular-nums text-foreground"
              />
            </PopoverDescription>
          </PopoverContent>
        </Popover>
      )}
      {composer && (
        <ComposerDialog
          key={composer.seed}
          open={composer.open}
          onOpenChange={(open) => setComposer((current) => (current ? { ...current, open } : current))}
          seed={composer.seed}
          userId={userId}
          onOpenHall={() => setComposer(null)}
        />
      )}
    </>
  )
}
