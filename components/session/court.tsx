"use client"

import { ChevronDownIcon, LandmarkIcon } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { KissTheHand } from "@/components/kiss-the-hand"
import { QueuePanel } from "@/components/queue-panel"
import { VainqueurControls } from "@/components/vainqueur-controls"
import { BountyPanel } from "@/components/bounty-panel"
import { ShameBoard } from "@/components/shame-board"
import { FearlessPanel } from "@/components/fearless-panel"

export interface CourtProps {
  userId: string | null
  playerId: string | null
  isAdmin: boolean
  sessionResolved: boolean
  onNextGame: () => void
}

function CourtPanels({ userId, playerId, isAdmin, sessionResolved, onNextGame }: CourtProps) {
  return (
    <div className="flex flex-col gap-4">
      <KissTheHand />
      <QueuePanel currentPlayerId={playerId} />
      <VainqueurControls isAdmin={isAdmin} currentPlayerId={playerId} sessionResolved={sessionResolved} onNextGame={onNextGame} />
      <FearlessPanel signedIn={!!userId} isAdmin={isAdmin} />
      <BountyPanel />
      <ShameBoard userId={userId} />
    </div>
  )
}

export function Court({ collapsible = false, ...props }: CourtProps & { collapsible?: boolean }) {
  if (!collapsible) {
    return (
      <section aria-label="The Court">
        <CourtPanels {...props} />
      </section>
    )
  }
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/court flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <LandmarkIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">The Court</span>
          <span className="block truncate text-xs text-muted-foreground">Praise, queue, fearless bans, bounties and shame</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/court:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <CourtPanels {...props} />
      </CollapsibleContent>
    </Collapsible>
  )
}
