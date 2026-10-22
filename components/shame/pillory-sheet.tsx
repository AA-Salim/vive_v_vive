"use client"

import type { ReactNode } from "react"
import { AnimatePresence } from "motion/react"
import { LogInIcon, MegaphoneIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CourtSheet } from "@/components/bounties/court-sheet"
import { RulesList } from "@/components/bounties/rules-list"
import { formatTimeLeft, useMsLeft } from "@/components/bounties/time-left"
import { PilloryCard } from "@/components/shame/pillory-card"
import { PILLORY_COPY, PILLORY_RULES_COPY } from "@/lib/bounties/copy"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import type { PilloryEntryView, PilloryWall } from "@/lib/bounties/types"

interface PillorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wall: PilloryWall | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  signedIn: boolean
  onSignIn: () => void
  onPost: () => void
  onEgg: (entry: PilloryEntryView) => void
  nested?: ReactNode
}

export function PillorySheet({ open, onOpenChange, wall, isPending, isError, onRetry, signedIn, onSignIn, onPost, onEgg, nested }: PillorySheetProps) {
  const cooldown = useMsLeft(wall?.viewer.nextPostAt ?? null)
  const available = wall?.available ?? false
  const entries = wall?.entries ?? []
  const coolingDown = cooldown !== null && cooldown > 0

  const footer = !signedIn ? (
    <Button onClick={onSignIn} className="h-11 w-full rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
      <LogInIcon aria-hidden />
      {PILLORY_COPY.loginHint}
    </Button>
  ) : available ? (
    <Button
      onClick={onPost}
      disabled={coolingDown}
      className="h-11 w-full rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
    >
      <MegaphoneIcon aria-hidden />
      {coolingDown ? `Next pillory in ${formatTimeLeft(cooldown ?? 0)}` : `${PILLORY_COPY.post} · ${PILLORY_RULES.cost}`}
    </Button>
  ) : null

  return (
    <CourtSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={MegaphoneIcon}
      title={PILLORY_COPY.title}
      description={PILLORY_COPY.sheetDescription}
      tone="roast"
      footer={footer}
    >
      <div className="space-y-4">
        <RulesList title="How the pillory works" rules={PILLORY_RULES_COPY} defaultOpen={entries.length === 0} />

        {wall && !available && (
          <p className="rounded-xl border border-dashed border-[var(--color-gold)]/30 px-3 py-3 text-center text-xs text-muted-foreground">{PILLORY_COPY.pending}</p>
        )}

        {isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading the wall">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : isError && !wall ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground" role="alert">
            {PILLORY_COPY.error}
            <Button variant="outline" className="h-10" onClick={onRetry}>
              <RotateCcwIcon aria-hidden />
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--color-gold)]/25 px-4 py-8 text-center">
            <MegaphoneIcon className="size-8 text-[var(--color-gold)]/60" aria-hidden />
            <p className="font-display text-base font-semibold text-[var(--color-gold-light)]">{PILLORY_COPY.empty}</p>
            <p className="text-xs text-muted-foreground">The Tribunal&apos;s next Inter goes up here for free.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <PilloryCard
                  key={entry.id}
                  entry={entry}
                  viewerPlayerId={wall?.viewer.playerId ?? null}
                  signedIn={signedIn}
                  canEgg={available}
                  onEgg={onEgg}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      {nested}
    </CourtSheet>
  )
}
