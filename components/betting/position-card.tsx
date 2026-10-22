"use client"

import { useState } from "react"
import { Loader2Icon, ShieldIcon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { BetTags } from "@/components/betting/bet-tags"
import { PayoutPreview } from "@/components/betting/payout-preview"
import { useInsureBet, type Market } from "@/components/betting/use-market"
import { noteChips, TitleChipRow } from "@/components/chaos/title-chips"
import { MARKET_COPY } from "@/lib/betting/copy"
import { betHelp, guardianHelp, insureLaterHelp } from "@/lib/betting/help"
import { coverageFor, otherSide, premiumFor, premiumPctFor, projectBet, sideLabel } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import { BASE_BET_TERMS, type BetTitleTerms } from "@/lib/betting/title-terms"
import type { MarketBet } from "@/lib/betting/types"
import { noteText, parseNotes } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

interface PositionCardProps {
  sessionId: string
  market: Market
  bet: MarketBet
  userId: string
  balance: number | null
  open: boolean
  terms?: BetTitleTerms
  onRaise?: () => void
}

interface InsuranceQuote {
  premium: number
  pct: number
  coverage: number
  available: boolean
  reason: string | null
}

const NO_QUOTE = { premium: 0, pct: 0, coverage: 0, available: false }

function insuranceQuote(market: Market, bet: MarketBet, terms: BetTitleTerms): InsuranceQuote {
  if (bet.insured) return { ...NO_QUOTE, reason: null }
  if (bet.all_in) return { ...NO_QUOTE, reason: "All-in bets cannot be insured." }
  if (market.rules_version === 1) {
    return { ...NO_QUOTE, reason: "Under the current rules, insurance is bought together with the bet." }
  }
  if (terms.insuranceBlocked) {
    const curse = terms.notesFor(bet.side).find((n) => n.key === "insurance_blocked")
    return { ...NO_QUOTE, reason: `No insurance: ${curse?.title ?? "a curse"} burns on you.` }
  }
  if (bet.amount < BET_RULES.insuranceMin) {
    return { ...NO_QUOTE, reason: `Insurance covers stakes of ${BET_RULES.insuranceMin} or more.` }
  }
  const mine = bet.side === "blue" ? market.blue_total : market.red_total
  const theirs = bet.side === "blue" ? market.red_total : market.blue_total
  const pct = terms.premiumPct(premiumPctFor(mine, theirs), bet.side)
  return {
    premium: premiumFor(bet.amount, pct),
    pct,
    coverage: coverageFor(bet.amount, terms.coveragePct),
    available: true,
    reason: null,
  }
}

export function PositionCard({ sessionId, market, bet, userId, balance, open, terms: viewerTerms, onRaise }: PositionCardProps) {
  const terms = market.rules_version === 2 && viewerTerms ? viewerTerms : BASE_BET_TERMS
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
    terms,
  })
  const quote = insuranceQuote(market, bet, terms)
  const cap = terms.cap
  const canRaise =
    open && market.rules_version === 2 && !bet.all_in && !(bet.scheme === "legacy" && bet.insured) && (cap == null || bet.amount < cap)
  const overLimit = purse - quote.premium < BET_RULES.debtFloor
  const notes = terms.notesFor(bet.side)
  const insuranceChips = noteChips(
    notes.filter((n) => n.key === "insurance_coverage_bonus" || n.key === "insurance_premium_salaxe_pct"),
    "position-insurance"
  )
  const capChips = noteChips(
    notes.filter((n) => n.key === "bet_cap" || (n.key === "all_in_bonus_pct" && bet.all_in)),
    "position-terms"
  )
  const quoteHelp = {
    rules: market.rules_version,
    stake: quote.available ? bet.amount : 0,
    premium: quote.premium,
    pct: quote.pct,
    coverage: quote.coverage,
    loser: otherSide(bet.side),
    coveragePct: terms.coveragePct,
    titleLines: insuranceChips.map((chip) => chip.detail ?? chip.label),
  }

  const buyInsurance = () => {
    insure.mutate({ rules: market.rules_version, maxPremium: quote.premium }, {
      onSuccess: (result) => {
        const titleLines = parseNotes(result.title_effects).map(
          (note) => ` ${noteText(note)}.`
        )
        toast.success(`${MARKET_COPY.insuranceTitle} hired.`, {
          description: `${quote.coverage} comes back if ${sideLabel(otherSide(bet.side))} wins. The ${result.premium} premium stays with the house unless the game is called off.${titleLines.join("")}`,
        })
      },
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

      <TitleChipRow chips={capChips} label="Your titles on this wager" />

      <PayoutPreview side={bet.side} projection={projection} exact={!open} allInPct={terms.allInBonusPct} />

      {open && (canRaise || quote.available || quote.reason) && (
        <div className={cn("grid gap-2", canRaise && quote.available && "sm:grid-cols-2")}>
          {canRaise && (
            <div className="flex min-w-0 items-center gap-1.5">
              <Button type="button" onClick={onRaise} className="h-11 min-w-0 flex-1 rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
                <TrendingUpIcon className="size-4" aria-hidden />
                Raise the stakes
              </Button>
              <InfoTip help={betHelp({ rules: market.rules_version, mode: "raise", side: bet.side, projection: null })} />
            </div>
          )}
          {quote.available && (
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                disabled={insure.isPending || overLimit}
                onClick={() => (purse - quote.premium < 0 ? setPledgeOpen(true) : buyInsurance())}
                className="h-auto min-h-11 min-w-0 flex-1 flex-col gap-0 rounded-xl border-emerald-400/40 py-1.5 text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-400/10"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {insure.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ShieldIcon className="size-4" aria-hidden />}
                  Hire the {MARKET_COPY.insuranceTitle} for {quote.premium}
                </span>
                <span className="text-[11px] font-normal text-emerald-300/75">
                  {quote.coverage} back if {sideLabel(otherSide(bet.side))} wins · {quote.pct}% of your stake
                </span>
              </Button>
              <InfoTip help={insureLaterHelp(quoteHelp)} align="end" />
            </div>
          )}
          {!quote.available && quote.reason && (
            <div className="flex items-center justify-center gap-1">
              <p className="text-center text-xs text-muted-foreground">{quote.reason}</p>
              <InfoTip help={guardianHelp(quoteHelp)} align="end" />
            </div>
          )}
          {quote.available && insuranceChips.length > 0 && (
            <TitleChipRow chips={insuranceChips} size="xs" className="justify-center sm:col-span-2" label="Guardian Angel titles" />
          )}
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
