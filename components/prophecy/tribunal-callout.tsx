"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { GavelIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useSession } from "@/hooks/use-session"
import { CountdownChip } from "@/components/prophecy/countdown-chip"
import { useOpenTribunal } from "@/components/prophecy/queries"
import { Tribunal } from "@/components/prophecy/tribunal"
import { useNow } from "@/components/prophecy/use-now"
import { useSettleWhenDue } from "@/components/prophecy/use-settle-when-due"
import { RESOLVED_STATUSES } from "@/lib/prophecy/constants"
import { joinNames } from "@/lib/prophecy/lines"

interface TribunalCalloutProps {
  hideForSessionId?: string | null
}

// Keeps the last game's tribunal reachable after the next game starts, then shows its verdict for a few minutes.
export function TribunalCallout({ hideForSessionId }: TribunalCalloutProps) {
  const query = useOpenTribunal()
  const { session } = useSession()
  const now = useNow()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const data = query.data
  const tribunal = data?.enabled ? data.tribunal : null
  const shownOnPage =
    hideForSessionId !== undefined
      ? hideForSessionId
      : session && RESOLVED_STATUSES.includes(session.status)
        ? session.id
        : null
  const key = tribunal ? `${tribunal.sessionId}:${tribunal.status}` : null
  const msLeft = tribunal && data ? Math.max(0, Date.parse(tribunal.closesAt) - (now - data.clockOffset)) : 0
  const voting = tribunal?.status === "open"
  useSettleWhenDue(voting && tribunal ? Date.parse(tribunal.closesAt) : null, !voting, data?.clockOffset ?? 0, query.refetch)
  const visible = !!tribunal && tribunal.sessionId !== shownOnPage && dismissed !== key && (!voting || msLeft > 0 || now === 0)

  return (
    <>
      <AnimatePresence initial={false}>
        {visible && tribunal && (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--color-gold)]/30 bg-card px-3 py-2.5"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--color-gold)]/10 to-transparent"
            />
            <GavelIcon className="relative size-5 shrink-0 text-[var(--color-gold)]" aria-hidden />
            <div className="relative min-w-0 flex-1">
              <div className="truncate font-display text-sm font-semibold text-[var(--color-gold)]">
                {voting ? "The tribunal is in session" : "The tribunal has spoken"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {voting
                  ? "Last game: crown the MVP, name the Inter."
                  : `MVP: ${joinNames(tribunal.mvpNames) ?? "no verdict"} · Inter: ${joinNames(tribunal.interNames) ?? "no verdict"}`}
              </div>
            </div>
            {voting && (
              <span className="relative hidden sm:block">
                <CountdownChip msLeft={msLeft} />
              </span>
            )}
            <Button
              onClick={() => setDialogOpen(true)}
              className="relative h-10 shrink-0 bg-[var(--color-gold)] px-4 font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
            >
              {voting ? "Vote" : "Verdict"}
            </Button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed(key)}
              className="relative -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={dialogOpen && !!tribunal} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90dvh] gap-2 overflow-y-auto bg-transparent p-0 ring-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">The Tribunal</DialogTitle>
          {tribunal && <Tribunal sessionId={tribunal.sessionId} />}
          <DialogClose render={<Button variant="outline" className="h-10 w-full" />}>Close</DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}
