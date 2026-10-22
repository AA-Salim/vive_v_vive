"use client"

import { useState } from "react"
import { BetFeed } from "@/components/betting/bet-feed"
import { BetSlip } from "@/components/betting/bet-slip"
import { LoginCta, MarketError, MarketSkeleton, PANEL_CLASS } from "@/components/betting/market-states"
import { MarketHeader, type MarketPhase } from "@/components/betting/market-header"
import { PoolBars } from "@/components/betting/pool-bars"
import { PositionCard } from "@/components/betting/position-card"
import { ResultReveal } from "@/components/betting/result-reveal"
import { useBetTerms } from "@/components/betting/use-bet-terms"
import { marketClock, useServerNow, type MarketClock } from "@/components/betting/use-clock"
import { useBettingBalance, useMarket, type Market } from "@/components/betting/use-market"
import { noteChips } from "@/components/chaos/title-chips"
import { useAuth } from "@/hooks/use-auth"
import { effectNotes } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

interface BettingPanelProps {
  sessionId: string
  isBettingOpen?: boolean
}

function phaseOf(market: Market, isBettingOpen: boolean, clock: MarketClock): MarketPhase {
  const status = market.session?.status
  if (status === "canceled" || status === "expired" || market.result?.refunded) return "refunded"
  if (market.result) return "settled"
  if (status === "betting") return isBettingOpen && !clock.isExpired ? "open" : "closing"
  return "locked"
}

export function BettingPanel({ sessionId, isBettingOpen = true }: BettingPanelProps) {
  const { user, signIn, isLoading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const market = useMarket(sessionId)
  const balance = useBettingBalance(userId)
  const [raising, setRaising] = useState(false)
  const data = market.data
  const now = useServerNow(data?.serverTimeDelta ?? 0, data?.session?.status === "betting")
  const { terms, fx, salaxeSide } = useBetTerms(sessionId)

  if (market.isPending) return <MarketSkeleton />
  if (!data) return <MarketError onRetry={() => market.refetch()} retrying={market.isFetching} />

  const clock = marketClock(data.session, now, userId ? terms.earlySeconds : undefined)
  const titleChips = userId ? noteChips(terms.notesFor(salaxeSide ?? "blue"), "market") : []
  const earlyChips = userId ? noteChips(effectNotes(fx, "early_window_bonus_s"), "early") : []
  const phase = phaseOf(data, isBettingOpen, clock)
  const entries = data.entries ?? data.bets
  const myBet = data.user_bet ?? (userId ? entries.find((b) => b.user_id === userId) ?? null : null)
  const purse = balance.data ?? null
  const settled = phase === "settled" || phase === "refunded"

  return (
    <section aria-labelledby="royal-wagers-title" className={cn(PANEL_CLASS, "@container")}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/70 to-transparent"
      />
      <MarketHeader
        phase={phase}
        clock={clock}
        rulesVersion={data.rules_version}
        titleChips={titleChips}
        earlyChips={earlyChips}
      />

      <div className="mt-4">
        <PoolBars
          blue={data.blue_total}
          red={data.red_total}
          blueMultiplier={data.blue_multiplier}
          redMultiplier={data.red_multiplier}
          blueCount={data.blue_count}
          redCount={data.red_count}
          winner={data.result?.winner ?? null}
          mySide={myBet?.side ?? null}
        />
      </div>

      <div className="mt-5 grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-4">
          {phase === "open" && !userId && <LoginCta onSignIn={signIn} loading={authLoading} />}

          {phase === "open" && userId && !myBet && (
            <BetSlip
              sessionId={sessionId}
              market={data}
              userId={userId}
              balance={purse}
              balanceLoading={balance.isPending}
              clock={clock}
              terms={terms}
              mode="new"
            />
          )}

          {phase === "open" && userId && myBet && raising && (
            <BetSlip
              sessionId={sessionId}
              market={data}
              userId={userId}
              balance={purse}
              balanceLoading={balance.isPending}
              clock={clock}
              terms={terms}
              mode="raise"
              onDone={() => setRaising(false)}
            />
          )}

          {userId && myBet && !settled && !(phase === "open" && raising) && (
            <PositionCard
              sessionId={sessionId}
              market={data}
              bet={myBet}
              userId={userId}
              balance={purse}
              open={phase === "open"}
              terms={terms}
              onRaise={() => setRaising(true)}
            />
          )}

          {!settled && phase !== "open" && !myBet && (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              {entries.length > 0 ? "You sat this one out. Watch, judge, take notes." : "No wagers on this game."}
            </p>
          )}

          {settled && data.result && (
            <ResultReveal
              sessionId={sessionId}
              result={data.result}
              bet={myBet}
              viewerId={userId}
              canceled={data.session?.status === "canceled" || data.session?.status === "expired"}
            />
          )}
        </div>

        <BetFeed bets={settled ? entries : data.bets} viewerId={userId} open={phase === "open"} />
      </div>
    </section>
  )
}
