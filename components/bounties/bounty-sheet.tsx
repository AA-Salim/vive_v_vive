"use client"

import { useEffect, type ReactNode } from "react"
import { AnimatePresence } from "motion/react"
import { CrosshairIcon, LogInIcon, PlusIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { CourtSheet } from "@/components/bounties/court-sheet"
import { HuntHistory } from "@/components/bounties/hunt-history"
import { RulesList } from "@/components/bounties/rules-list"
import { WantedPoster } from "@/components/bounties/wanted-poster"
import { useOnTheRift } from "@/components/bounties/use-wanted"
import { WARRANT_COPY, WARRANT_RULES } from "@/lib/bounties/copy"
import { WARRANT_HELP } from "@/lib/bounties/help"
import type { BountyBoard, WarrantView } from "@/lib/bounties/types"

interface BountySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: BountyBoard | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  focusId: string | null
  signedIn: boolean
  onSignIn: () => void
  onPledge: (warrant: WarrantView | null) => void
  // Dialogs opened from the sheet render inside it so the two modals nest instead of competing for focus.
  nested?: ReactNode
}

export function liveFirst(warrants: WarrantView[], onTheRift: Set<string>): WarrantView[] {
  if (onTheRift.size === 0) return warrants
  return [...warrants].sort((a, b) => Number(onTheRift.has(b.target.playerId)) - Number(onTheRift.has(a.target.playerId)))
}

export function BountySheet({
  open,
  onOpenChange,
  board,
  isPending,
  isError,
  onRetry,
  focusId,
  signedIn,
  onSignIn,
  onPledge,
  nested,
}: BountySheetProps) {
  useEffect(() => {
    if (!open || !focusId) return
    const timer = setTimeout(() => document.getElementById(`warrant-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 120)
    return () => clearTimeout(timer)
  }, [open, focusId])

  const onTheRift = useOnTheRift()
  const available = board?.available ?? false
  const warrants = liveFirst(board?.warrants ?? [], onTheRift)
  const canPledge = signedIn && available

  const footer = !signedIn ? (
    <Button onClick={onSignIn} className="h-11 w-full rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
      <LogInIcon aria-hidden />
      {WARRANT_COPY.loginHint}
    </Button>
  ) : available ? (
    <div className="flex w-full items-center gap-2.5">
      <Button
        onClick={() => onPledge(null)}
        className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-red-team)]/50 bg-[var(--color-red-team)]/20 font-semibold text-[var(--color-gold-light)] hover:bg-[var(--color-red-team)]/30"
      >
        <PlusIcon aria-hidden />
        {WARRANT_COPY.post}
      </Button>
      <InfoTip help={WARRANT_HELP.pledge} side="top" align="end" />
    </div>
  ) : null

  return (
    <CourtSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={CrosshairIcon}
      title={WARRANT_COPY.title}
      description={WARRANT_COPY.sheetDescription}
      tone="danger"
      help={WARRANT_HELP.board}
      footer={footer}
    >
      <div className="space-y-4">
        <RulesList title="How warrants work" rules={WARRANT_RULES} defaultOpen={warrants.length === 0} />

        {board && !available && (
          <p className="rounded-xl border border-dashed border-[var(--color-gold)]/30 px-3 py-3 text-center text-xs text-muted-foreground">
            {WARRANT_COPY.pending}
          </p>
        )}

        {isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading warrants">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : isError && !board ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground" role="alert">
            {WARRANT_COPY.error}
            <Button variant="outline" className="h-10" onClick={onRetry}>
              <RotateCcwIcon aria-hidden />
              Try again
            </Button>
          </div>
        ) : warrants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--color-red-team)]/30 px-4 py-8 text-center">
            <CrosshairIcon className="size-8 text-[var(--color-red-team)]/60" aria-hidden />
            <p className="font-display text-base font-semibold text-[var(--color-gold-light)]">{WARRANT_COPY.empty}</p>
            <p className="text-xs text-muted-foreground">One pledge prints the poster. Everyone else can stack on it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {warrants.map((warrant) => (
                <WantedPoster
                  key={warrant.id}
                  id={`warrant-${warrant.id}`}
                  warrant={warrant}
                  viewerPlayerId={board?.viewer.playerId ?? null}
                  canPledge={canPledge}
                  live={onTheRift.has(warrant.target.playerId)}
                  highlighted={warrant.id === focusId}
                  onPledge={onPledge}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <HuntHistory records={board?.recent ?? []} />
      </div>
      {nested}
    </CourtSheet>
  )
}
