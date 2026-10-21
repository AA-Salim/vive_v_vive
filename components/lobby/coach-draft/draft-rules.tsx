"use client"

import { CircleHelpIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function DraftRules({ host, undoSupported }: { host: string; undoSupported: boolean }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Coach draft rules"
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CircleHelpIcon className="size-4" aria-hidden />
        Rules
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-2 border border-[var(--color-gold)]/20 p-3.5">
        <p className="font-display text-sm font-semibold text-[var(--color-gold)]">How the coaches draft</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>Snake order: Blue, Red, Red, Blue, Blue, Red, Red, Blue, Blue, Red.</li>
          <li>Only the coach on the clock can pick. Tap a player, then lock in.</li>
          <li>
            {undoSupported
              ? "Misclick? The coach who made the latest pick can take it back until the next pick lands."
              : "Picks are final once locked in."}
          </li>
          <li>With ten drafted, each coach sets lanes for their own five. Tapping a taken lane swaps the two.</li>
          <li>Either coach locks the teams once both have five lanes. Champions are then dealt at random, fearless bans included.</li>
          <li>{host} or an admin can scrap the draft from the header.</li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
