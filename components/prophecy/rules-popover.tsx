"use client"

import { InfoIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { MVP_BONUS, STAKE_MAX, STAKE_MIN } from "@/lib/prophecy/constants"

const RULES = [
  `One prophecy per game: MVP or Inter, ${STAKE_MIN} to ${STAKE_MAX} points, sealed before betting closes.`,
  "When the Nexus falls, everyone votes for the MVP and the Inter. Nobody votes for themselves.",
  "Prophets who called the voted player split the whole pot of that market by stake. Lonely calls pay the most.",
  "No verdict, or nobody called it? Every stake in that market comes back.",
  `The crowned MVP earns +${MVP_BONUS}. The Inter earns a roast.`,
  "You cannot back yourself as the Inter. The court has seen that trick before.",
]

export function RulesPopover() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="How prophecies work"
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InfoIcon className="size-[18px]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-2 p-3">
        <PopoverTitle className="font-display text-sm text-[var(--color-gold)]">The Oracle&apos;s rules</PopoverTitle>
        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {RULES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-gold)]/70" />
              {rule}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
