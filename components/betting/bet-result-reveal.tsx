"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResultReveal } from "@/components/betting/result-reveal"
import { useMarket } from "@/components/betting/use-market"
import { useLive, useLiveSignal } from "@/components/live/live-provider"

// Pops the personal payout reveal for everyone who had a bet, wherever they are on the page.
export function BetResultReveal() {
  const { userId } = useLive()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || signal.event.type !== "bet.resolved" || !signal.event.sessionId) return
    setSessionId(signal.event.sessionId)
  })

  const market = useMarket(sessionId, !!userId)
  const bet = market.data?.user_bet ?? null
  const result = market.data?.result ?? null
  const open = !!sessionId && sessionId !== dismissed && !!result && !!bet && bet.status !== "pending"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissed(sessionId)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto border border-[var(--color-gold)]/25 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[var(--color-gold)]">The notebook settles up</DialogTitle>
          <DialogDescription>Every wager on the last game has been paid out.</DialogDescription>
        </DialogHeader>
        {sessionId && result && (
          <ResultReveal sessionId={sessionId} result={result} bet={bet} viewerId={userId} />
        )}
      </DialogContent>
    </Dialog>
  )
}
