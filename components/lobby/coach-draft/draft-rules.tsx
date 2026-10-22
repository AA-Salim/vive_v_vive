"use client"

import { CircleHelpIcon } from "lucide-react"
import { HelpRows } from "@/components/ui/info-tip"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { CHAMPION_PICK_SECONDS } from "@/lib/lobby/champion-pick"
import { LOBBY_SIZE, TEAM_SIZE } from "@/lib/lobby/constants"
import { COACH_HELP } from "@/lib/lobby/help"

// The draft board's info bubble: what the coaches do, the full rules, and what it costs (nothing).
export function DraftRules({ host, undoSupported, championPicks = false }: { host: string; undoSupported: boolean; championPicks?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        aria-label="Coach draft rules"
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-[var(--color-gold)]/50 data-[popup-open]:text-[var(--color-gold)]"
      >
        <CircleHelpIcon className="size-4" aria-hidden />
        Rules
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2">
        <PopoverTitle className="font-display text-sm">{COACH_HELP.board.title}</PopoverTitle>
        <PopoverDescription className="text-xs leading-relaxed">{COACH_HELP.board.does}</PopoverDescription>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>Only the coach on the clock can pick. Tap a player, then lock in.</li>
          <li>
            {undoSupported
              ? "Misclick? The coach who made the latest pick can take it back until the next pick lands."
              : "Picks are final once locked in."}
          </li>
          <li>
            With {LOBBY_SIZE} drafted, each coach sets lanes for their own {TEAM_SIZE}. Tapping a taken lane swaps the two.
          </li>
          <li>
            {championPicks
              ? `Either coach locks the teams once both have ${TEAM_SIZE} lanes. Then champion select: the coaches pick every champion in draft order (Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1), ${CHAMPION_PICK_SECONDS} seconds per pick, fearless bans included.`
              : `Either coach locks the teams once both have ${TEAM_SIZE} lanes. Champions are then dealt at random, fearless bans included.`}
          </li>
          <li>{host} or an admin can scrap the draft from the header.</li>
        </ul>
        <HelpRows help={COACH_HELP.board} />
      </PopoverContent>
    </Popover>
  )
}
