"use client"

import { InfoIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { DUEL_COPY, DUEL_RULE_LINES } from "@/lib/duels/copy"

export function DuelRules() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="How trials by combat work"
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InfoIcon className="size-[18px]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-2 p-3">
        <PopoverTitle className="font-display text-sm text-[var(--color-gold)]">The laws of the lists</PopoverTitle>
        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {DUEL_RULE_LINES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-gold)]/70" />
              {rule}
            </li>
          ))}
        </ul>
        <p className="border-t border-border/60 pt-2 text-[11px] italic leading-relaxed text-[var(--color-gold-light)]/70">
          {DUEL_COPY.tithe}
        </p>
      </PopoverContent>
    </Popover>
  )
}
