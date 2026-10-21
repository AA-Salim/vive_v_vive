"use client"

import { useState } from "react"
import { CrownIcon, DicesIcon, Loader2Icon, LockIcon, PlayIcon, ScrollTextIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/session/confirm-dialog"
import { DeclareWinnerDialog } from "@/components/session/declare-winner-dialog"
import { useSessionActions } from "@/components/session/use-session-actions"
import { STALE_CLAIM_MS } from "@/lib/session/constants"
import type { RoomSession, SessionActionName } from "@/lib/session/types"
import { cn } from "@/lib/utils"

interface SessionControlsProps {
  session: RoomSession
  canControl: boolean
  isAdmin?: boolean
  serverNow?: number | null
  onSignIn?: () => void
  onAction?: () => void
  className?: string
}

type Pending = "cancel" | "close_chaos" | "close_betting" | "declare" | null

const BIG = "h-11 px-4 text-sm sm:h-10"

export function SessionControls({ session, canControl, isAdmin = false, serverNow = null, onSignIn, onAction, className }: SessionControlsProps) {
  const { runAsync, pending } = useSessionActions(session, onSignIn)
  const [dialog, setDialog] = useState<Pending>(null)

  if (!canControl) return null

  const busy = pending !== null
  const claimAge = session.resolved_by && serverNow !== null ? serverNow - Date.parse(session.updated_at) : null
  const resolving = session.status === "in_game" && !!session.resolved_by && claimAge !== null && claimAge < STALE_CLAIM_MS
  const stalled = session.status === "in_game" && !!session.resolved_by && claimAge !== null && claimAge >= STALE_CLAIM_MS
  const unlocked = session.session_assignments.filter((a) => !a.locked).length

  const run = async (action: Exclude<SessionActionName, "toggle_lock" | "declare_winner">, after?: () => void) => {
    try {
      await runAsync({ action })
      after?.()
      onAction?.()
    } catch {}
    setDialog(null)
  }

  const label = (name: SessionActionName, idle: string, working: string) => (pending === name ? working : idle)
  const spinner = (name: SessionActionName, Icon: typeof PlayIcon) =>
    pending === name ? <Loader2Icon className="animate-spin" aria-hidden /> : <Icon aria-hidden />

  const cancelButton = (
    <Button
      variant="ghost"
      className={cn(BIG, "text-muted-foreground hover:text-[var(--color-red-team)]")}
      onClick={() => setDialog("cancel")}
      disabled={busy || resolving || (stalled && !isAdmin)}
    >
      <XIcon aria-hidden />
      {session.status === "coach_draft" ? "Cancel draft" : "Cancel game"}
    </Button>
  )

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {session.status === "draft" && (
        <>
          <Button className={cn(BIG, "font-semibold")} onClick={() => run("start_game")} disabled={busy}>
            {spinner("start_game", PlayIcon)}
            {label("start_game", "Start game", "Opening decrees...")}
          </Button>
          <Button variant="outline" className={BIG} onClick={() => run("reroll")} disabled={busy || unlocked === 0}>
            {spinner("reroll", DicesIcon)}
            {label("reroll", "Re-roll", "Rolling...")}
            {pending !== "reroll" && unlocked < 10 && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground" aria-label={`${unlocked} unlocked`}>
                {unlocked}
              </span>
            )}
          </Button>
        </>
      )}

      {session.status === "chaos" && (
        <Button variant="outline" className={BIG} onClick={() => setDialog("close_chaos")} disabled={busy}>
          {spinner("close_chaos", ScrollTextIcon)}
          Close decrees now
        </Button>
      )}

      {session.status === "betting" && (
        <Button variant="outline" className={BIG} onClick={() => setDialog("close_betting")} disabled={busy}>
          {spinner("close_betting", LockIcon)}
          Lock bets now
        </Button>
      )}

      {session.status === "in_game" && (
        <Button className={cn(BIG, "font-semibold")} onClick={() => setDialog("declare")} disabled={busy || resolving}>
          {resolving || pending === "declare_winner" ? <Loader2Icon className="animate-spin" aria-hidden /> : <CrownIcon aria-hidden />}
          {resolving ? "Settling the gold..." : stalled ? "Retry declaration" : "Declare winner"}
        </Button>
      )}

      {cancelButton}

      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        title={session.status === "coach_draft" ? "Scrap the coach draft?" : "Cancel this game?"}
        description="Nothing gets recorded. Every bet, insurance premium, decree and duel stake goes straight back to its owner."
        confirmLabel={pending === "cancel" ? "Canceling..." : "Cancel the game"}
        cancelLabel="Keep playing"
        destructive
        pending={pending === "cancel"}
        onConfirm={() => run("cancel", () => toast("Game canceled. Every wager was refunded."))}
      />
      <ConfirmDialog
        open={dialog === "close_chaos"}
        onOpenChange={(open) => setDialog(open ? "close_chaos" : null)}
        title="Close the decree window?"
        description="Nobody can cast a decree after this. Betting opens right away for five minutes."
        confirmLabel="Close decrees"
        pending={pending === "close_chaos"}
        onConfirm={() => run("close_chaos")}
      />
      <ConfirmDialog
        open={dialog === "close_betting"}
        onOpenChange={(open) => setDialog(open ? "close_betting" : null)}
        title="Lock all bets now?"
        description="Nobody can bet or buy insurance after this, even with time left on the clock."
        confirmLabel="Lock bets"
        pending={pending === "close_betting"}
        onConfirm={() => run("close_betting")}
      />
      {session.status === "in_game" && (
        <DeclareWinnerDialog
          session={session}
          open={dialog === "declare"}
          onOpenChange={(open) => setDialog(open ? "declare" : null)}
          pending={pending === "declare_winner"}
          onConfirm={async (side) => {
            try {
              await runAsync({ action: "declare_winner", winner_side: side })
              onAction?.()
            } catch {}
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}
