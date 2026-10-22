"use client"

import { useState } from "react"
import { LayersIcon, ZapIcon } from "lucide-react"
import { TitleLoadout } from "@/components/profile/title-loadout"
import { loadoutOf } from "@/components/titles/loadout-chips"
import { LoadoutDialog, LoadoutTrigger } from "@/components/titles/loadout-dialog"
import { SLOT_HELP } from "@/components/titles/loadout-parts"
import { InfoTip } from "@/components/ui/info-tip"
import { useAuth } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { summarizeLoadout } from "@/lib/titles/effects"
import { MAX_EQUIPPED, type LoadoutSlot } from "@/lib/titles/loadout"
import { useTitlesSealed } from "@/lib/titles/use-titles"
import { cn } from "@/lib/utils"

interface LoadoutPanelProps {
  // The wearer's account; null for an unclaimed seat.
  userId: string | null
  name: string
  className?: string
}

// The titles block of every profile hero: build line, the one loadout button, the 2/3/4 slots and the curses.
// Yourself: "Edit loadout" and tappable empty slots. Anyone else: "See their strategy".
export function LoadoutPanel({ userId, name, className }: LoadoutPanelProps) {
  const { user } = useAuth()
  const { byUserId } = useEquippedTitles()
  const isSelf = !!user && !!userId && user.id === userId
  const sealed = useTitlesSealed(isSelf)
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<LoadoutSlot | null>(null)

  const entry = userId ? byUserId.get(userId) : undefined
  const worn = entry ? loadoutOf(entry).length : 0
  const summary = summarizeLoadout(entry)
  const show = (next: LoadoutSlot | null) => {
    setSlot(next)
    setOpen(true)
  }

  return (
    <section aria-label={isSelf ? "Your titles" : `Titles of ${name}`} className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)]/85 uppercase">
            <LayersIcon aria-hidden className="size-3.5" />
            {isSelf ? "Your loadout" : "Loadout"}
            {userId ? (
              <span className="font-normal tracking-normal text-muted-foreground normal-case tabular-nums">
                · {worn} of {MAX_EQUIPPED} worn
              </span>
            ) : null}
            <InfoTip help={SLOT_HELP} />
          </p>
          {userId ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-[var(--color-gold-light)]/85">
              <ZapIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" />
              <span className="min-w-0">
                {summary.text || (isSelf ? "No title bends the rules for you yet." : `No title bends the rules for ${name} right now.`)}
              </span>
            </p>
          ) : null}
        </div>
        {userId ? (
          <LoadoutTrigger
            isSelf={isSelf}
            sealed={sealed}
            onClick={() => show(null)}
            label={isSelf ? "Edit loadout" : undefined}
            variant={isSelf && !sealed ? "royal" : "outline"}
            className={cn("w-full shrink-0 sm:w-auto", !isSelf && "border-[var(--color-gold)]/45 text-[var(--color-gold-light)]")}
          />
        ) : null}
      </div>

      <TitleLoadout entry={entry} linked={!!userId} onEmpty={isSelf ? show : undefined} disabled={sealed} />

      {userId ? <LoadoutDialog open={open} onOpenChange={setOpen} userId={userId} mode={isSelf ? "edit" : "view"} name={name} slot={slot} /> : null}
    </section>
  )
}
