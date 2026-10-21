"use client"

import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { FastForwardIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MapView } from "@/components/map-view"
import { TeamList } from "@/components/team-list"
import { LaneMatchups } from "@/components/session/lane-matchups"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { useReveal } from "@/components/session/use-reveal"
import type { BoardViewProps } from "@/components/session/board-types"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { ROLE_LABELS } from "@/lib/champions"
import { winnerOf } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"

interface MatchBoardProps {
  session: RoomSession
  serverTimeDelta: number
  meId?: string | null
  canLock: boolean
  pendingLocks?: Set<string>
  onToggleLock?: (assignmentId: string) => void
}

const NO_LOCKS = new Set<string>()

export function MatchBoard({ session, serverTimeDelta, meId = null, canLock, pendingLocks = NO_LOCKS, onToggleLock }: MatchBoardProps) {
  const reveal = useReveal(session, serverTimeDelta)
  const { byPlayerId } = useEquippedTitles()
  const isLg = useMediaQuery("(min-width: 1024px)")
  const isMd = useMediaQuery("(min-width: 768px)")
  const draft = session.status === "draft"
  const lockable = canLock && draft && !reveal.revealing

  const view: BoardViewProps = {
    assignments: session.session_assignments,
    frame: reveal.frame,
    titles: byPlayerId,
    winner: winnerOf(session.status),
    draft,
    canLock: lockable,
    pendingLocks,
    onToggleLock: lockable ? onToggleLock : undefined,
    animateLayout: !reveal.revealing,
    meId,
  }

  return (
    <section aria-label="Teams" className="relative flex flex-col gap-3">
      <AnimatePresence>
        {reveal.frame && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-3 py-2"
            role="status"
          >
            <SparklesIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {reveal.frame.activeLane ? `Fate deals ${ROLE_LABELS[reveal.frame.activeLane]}` : "Fate shuffles the deck"}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-gold)]/15">
                <div
                  className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-100 ease-linear"
                  style={{ width: `${reveal.frame.progress * 100}%` }}
                />
              </div>
            </div>
            <Button variant="ghost" className="h-10 shrink-0 text-[var(--color-gold-light)]" onClick={reveal.skip}>
              <FastForwardIcon aria-hidden />
              Skip
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <LayoutGroup id={`board-${session.id}`}>
        {isLg ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4">
            <TeamList side="blue" {...view} />
            <MapView assignments={view.assignments} frame={view.frame} winner={view.winner} className="self-center" />
            <TeamList side="red" mirrored {...view} />
          </div>
        ) : isMd ? (
          <div className="grid grid-cols-2 gap-3">
            <TeamList side="blue" {...view} />
            <TeamList side="red" mirrored {...view} />
          </div>
        ) : (
          <LaneMatchups {...view} />
        )}
      </LayoutGroup>
    </section>
  )
}
