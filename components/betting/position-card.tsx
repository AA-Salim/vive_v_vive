"use client"

import { useState } from "react"
import { Loader2Icon, ShieldIcon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { BetTags } from "@/components/betting/bet-tags"
import { PayoutPreview } from "@/components/betting/payout-preview"
import { useInsureBet, type Market } from "@/components/betting/use-market"
import { MARKET_COPY } from "@/lib/betting/copy"
import { coverageFor, otherSide, premiumFor, projectBet, sideLabel } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import type { MarketBet } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

interface PositionCardProps {
  sessionId: string
  market: Market
  bet: MarketBet
  userId: string
  balance: number | null
  open: boolean
  onRaise?: () => void
}

function insuranceQuote(market: Market, bet: MarketBet): { premium: number; coverage: number; available: boolean; reason: string | null } {
  if (bet.insured) return { premium: 0, coverage: 0, available: false, reason: null }
  if (bet.all_in) return { premium: 0, coverage: 0, available: false, reason: "All-in bets cannot be insured." }
  if (market.rules_version === 1) {
    return { premium: 0, coverage: 0, available: false, reason: "Under the current rules, insurance is bought together with the bet." }
  }
  if (bet.amount < BET_RULES.insuranceMin) {
    return { premium: 0, coverage: 0, available: false, reason: `Insurance covers stakes of ${BET_RULES.insuranceMin} or more.` }
  }
  return { premium: premiumFor(bet.amount), coverage: coverageFor(bet.amount, BET_RULES.coveragePct), available: true, reason: null }
}

export function PositionCard({ sessionId, market, bet, userId, balance, open, onRaise }: PositionCardProps) {
  const insure = useInsureBet(sessionId, userId)
  const [pledgeOpen, setPledgeOpen] = useState(false)
  const purse = balance ?? 0
  const sideText = bet.side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
  const projection = projectBet({
    rules: market.rules_version,
    side: bet.side,
    pools: { blue: market.blue_total, red: market.red_total },
    current: bet,
    add: 0,
    early: false,
    allIn: false,
    insure: false,
  })
  const quote = insuranceQuote(market, bet)
  const canRaise = open && market.rules_version === 2 && !bet.all_in && !(bet.scheme === "legacy" && bet.insured)
  const overLimit = purse - quote.premium < BET_RULES.debtFloor

  const buyInsurance = () => {
    insure.mutate(market.rules_version, {
      onSuccess: (result) =>
        toast.success(`${MARKET_COPY.insuranceTitle} hired.`, {
          description: `${quote.coverage} comes back if ${sideLabel(otherSide(bet.side))} wins. The ${result.premium} premium is the house's either way.`,
        }),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-gold)]/25 bg-[var(--color-navy)]/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Your wager</div>
          <div className="font-display text-2xl font-semibold tabular-nums text-[var(--color-gold-light)]">
            {bet.amount} <span className="text-base text-muted-foreground">on</span>{" "}
            <span className={sideText}>{sideLabel(bet.side)}</span>
          </div>
        </div>
        <BetTags bet={bet} />
      </div>

      <PayoutPreview side={bet.side} projection={projection} exact={!open} />

      {open && (canRaise || quote.available || quote.reason) && (
        <div className={cn("grid gap-2", canRaise && quote.available && "sm:grid-cols-2")}>
          {canRaise && (
            <Button type="button" onClick={onRaise} className="h-11 rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
              <TrendingUpIcon className="size-4" aria-hidden />
              Raise the stakes
            </Button>
          )}
          {quote.available && (
            <Button
              type="button"
              variant="outline"
              disabled={insure.isPending || overLimit}
              onClick={() => (purse - quote.premium < 0 ? setPledgeOpen(true) : buyInsurance())}
              className="h-auto min-h-11 flex-col gap-0 rounded-xl border-emerald-400/40 py-1.5 text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-400/10"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {insure.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ShieldIcon className="size-4" aria-hidden />}
                Hire the {MARKET_COPY.insuranceTitle} for {quote.premium}
              </span>
              <span className="text-[11px] font-normal text-emerald-300/75">
                {quote.coverage} back if {sideLabel(otherSide(bet.side))} wins
              </span>
            </Button>
          )}
          {!quote.available && quote.reason && <p className="text-center text-xs text-muted-foreground">{quote.reason}</p>}
        </div>
      )}

      <DebtPledgeDialog
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
        currentBalance={purse}
        cost={quote.premium}
        actionLabel="insurance"
        onConfirm={buyInsurance}
      />
    </div>
  )
}
