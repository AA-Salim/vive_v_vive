"use client"

import { LoaderCircleIcon, LogInIcon, SwordsIcon, Undo2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { takeBlock, takeBlockLabel } from "@/lib/duels/eligibility"
import { SIDE_NAME, otherSide } from "@/lib/duels/rules"
import type { DuelAction, DuelView } from "@/lib/duels/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ActionViewer {
  userId: string | null
  side: Side | null
  balance: number | null
}

interface DuelActionsProps {
  duel: DuelView
  viewer: ActionViewer
  rivals: ReadonlySet<string>
  pendingAction: DuelAction | null
  busy: boolean
  onAction: (duel: DuelView, action: DuelAction) => void
  onSignIn: () => void
}

const GOLD = "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"

function Spinner() {
  return <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
}

export function DuelActions({ duel, viewer, rivals, pendingAction, busy, onAction, onSignIn }: DuelActionsProps) {
  if (duel.status !== "open" || duel.id.startsWith("optimistic-")) return null
  const mine = !!viewer.userId && duel.challenger.userId === viewer.userId

  if (mine) {
    return (
      <Button
        variant="ghost"
        onClick={() => onAction(duel, "withdraw")}
        disabled={busy}
        className="h-10 w-full gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {pendingAction === "withdraw" ? <Spinner /> : <Undo2Icon className="size-4" aria-hidden />}
        Withdraw and take back {duel.stake}
      </Button>
    )
  }

  if (!duel.isOpen) return null

  const block = takeBlock(duel, viewer, rivals)
  if (block === "signed_out") {
    return (
      <Button variant="outline" onClick={onSignIn} className="h-10 w-full gap-1.5">
        <LogInIcon className="size-4" aria-hidden />
        Sign in to answer
      </Button>
    )
  }

  const answer = SIDE_NAME[otherSide(duel.challengerSide)]
  return (
    <Button
      onClick={() => onAction(duel, "accept")}
      disabled={!!block || busy}
      className={cn("h-10 w-full gap-1.5 rounded-lg font-semibold", !block && GOLD)}
      variant={block ? "outline" : "default"}
    >
      {pendingAction === "accept" ? <Spinner /> : <SwordsIcon className="size-4" aria-hidden />}
      {block ? takeBlockLabel(block, duel) : `Take ${answer} · ${duel.stake}`}
    </Button>
  )
}

interface RespondButtonsProps {
  duel: DuelView
  pendingAction: DuelAction | null
  busy: boolean
  cannotAfford: boolean
  onAction: (duel: DuelView, action: DuelAction) => void
}

export function RespondButtons({ duel, pendingAction, busy, cannotAfford, onAction }: RespondButtonsProps) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
      <Button variant="outline" onClick={() => onAction(duel, "decline")} disabled={busy} className="h-11 gap-1.5 rounded-lg">
        {pendingAction === "decline" && <Spinner />}
        Decline
      </Button>
      <Button
        onClick={() => onAction(duel, "accept")}
        disabled={busy || cannotAfford}
        className={cn("h-11 gap-1.5 rounded-lg font-semibold", GOLD)}
      >
        {pendingAction === "accept" ? <Spinner /> : <SwordsIcon className="size-4" aria-hidden />}
        {cannotAfford ? "Purse too light" : `Accept · ${duel.stake}`}
      </Button>
    </div>
  )
}
