"use client"

import { useId, useState, type FormEvent } from "react"
import { Loader2Icon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { InsuranceToggle } from "@/components/betting/insurance-toggle"
import { PayoutPreview } from "@/components/betting/payout-preview"
import { SidePicker } from "@/components/betting/side-picker"
import { StakePicker } from "@/components/betting/stake-picker"
import { usePlaceBet, type Market } from "@/components/betting/use-market"
import type { MarketClock } from "@/components/betting/use-clock"
import { MARKET_COPY } from "@/lib/betting/copy"
import {
  coverageFor,
  maxAffordableAdd,
  otherSide,
  premiumFor,
  projectBet,
  sideLabel,
  usesLegacyTerms,
} from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import type { PlaceBetInput, PlaceBetResult } from "@/lib/betting/types"
import type { Side } from "@/lib/types"

interface BetSlipProps {
  sessionId: string
  market: Market
  userId: string
  balance: number | null
  balanceLoading: boolean
  clock: MarketClock
  mode: "new" | "raise"
  onDone?: () => void
}

function placedToast(input: PlaceBetInput, result: PlaceBetResult, mode: "new" | "raise", coverage: number) {
  const side = sideLabel(input.side)
  const total = typeof result.bet?.amount === "number" ? result.bet.amount : result.staked
  const lines: string[] = []
  if (result.early) lines.push(`Early conviction locked: +${BET_RULES.earlyBonusPct}% on profit.`)
  if (result.all_in) lines.push(`All-in. +${BET_RULES.allInBonusPct}% on profit if you are right. If not, the court will hear about it.`)
  if (result.premium > 0) {
    lines.push(
      result.rules === 2
        ? `Guardian Angel hired: ${coverage} comes back if ${sideLabel(otherSide(input.side))} wins.`
        : `Insured for ${result.premium}: half your stake back if you lose.`
    )
  }
  toast.success(mode === "raise" ? `Raised to ${total} on ${side}.` : `${total} on ${side}. Written in the notebook.`, {
    description: lines.join(" ") || undefined,
  })
}

export function BetSlip({ sessionId, market, userId, balance, balanceLoading, clock, mode, onDone }: BetSlipProps) {
  const ids = useId()
  const rules = market.rules_version
  const current = mode === "raise" ? market.user_bet : null
  const [pickedSide, setPickedSide] = useState<Side | null>(null)
  const [amountText, setAmountText] = useState("")
  const [allIn, setAllIn] = useState(false)
  const [insure, setInsure] = useState(false)
  const [pledge, setPledge] = useState<{ input: PlaceBetInput; cost: number } | null>(null)
  const place = usePlaceBet(sessionId, userId)

  const side = current?.side ?? pickedSide
  const purse = balance ?? 0
  const legacy = usesLegacyTerms(rules, current)
  const allInStake = Math.max(purse, 0)
  const amount = allIn ? allInStake : Number.parseInt(amountText, 10) || 0
  const allInBonus = allIn && rules === 2
  const alreadyInsured = !!current?.insured
  const insureNow = !allInBonus && (alreadyInsured || insure)
  const early = rules === 2 && clock.isEarly

  const projection = side
    ? projectBet({
        rules,
        side,
        pools: { blue: market.blue_total, red: market.red_total },
        current,
        add: amount,
        early,
        allIn: allInBonus,
        insure: insureNow,
      })
    : null

  const maxAdd = maxAffordableAdd(purse, rules, current, insureNow)
  const sliderMax = purse > 0 ? Math.min(purse, maxAdd) : maxAdd
  const stakeAfter = (current?.amount ?? 0) + amount
  const allInEnabled = rules === 2 ? purse >= 1 && (current?.amount ?? 0) + purse >= BET_RULES.allInMin && !alreadyInsured : purse >= 1

  const insuranceReason = allInBonus
    ? "All-in bets cannot be insured. Die with your boots on."
    : !alreadyInsured && rules === 2 && amount > 0 && stakeAfter < BET_RULES.insuranceMin
      ? `Covers stakes of ${BET_RULES.insuranceMin} or more.`
      : null
  const quoteStake = stakeAfter > 0 ? stakeAfter : 0
  const premiumQuote = alreadyInsured || insure
    ? projection?.premiumAdd ?? 0
    : legacy
      ? BET_RULES.legacyPremium
      : Math.max(premiumFor(quoteStake) - (current?.premium ?? 0), 0)
  const coverageQuote = projection?.insured ? projection.lose.coverage : coverageFor(quoteStake, legacy ? BET_RULES.legacyCoveragePct : BET_RULES.coveragePct)

  const reason = clock.isExpired
    ? "Betting has closed."
    : balanceLoading
      ? "Reading your purse..."
      : !side
        ? "Pick a side first."
        : amount < 1
          ? allIn
            ? "Your purse is empty. Nothing to shove."
            : mode === "raise"
              ? "Choose how much to add."
              : "Choose a stake."
          : allInBonus && stakeAfter < BET_RULES.allInMin
            ? `All-in needs at least ${BET_RULES.allInMin} points on the line.`
            : insureNow && rules === 2 && stakeAfter < BET_RULES.insuranceMin
              ? `The Guardian Angel covers stakes of ${BET_RULES.insuranceMin} or more.`
              : projection && projection.cost > purse - BET_RULES.debtFloor
                ? maxAdd > 0
                  ? `Over the debt limit. You can put in at most ${maxAdd}.`
                  : `Debt limit reached (${BET_RULES.debtFloor}). Even Salaxe's notebook has a last page.`
                : null

  const submitLabel = !side
    ? "Pick a side"
    : allInBonus
      ? `Go all-in: ${stakeAfter} on ${sideLabel(side)}`
      : mode === "raise"
        ? `Raise to ${stakeAfter}`
        : amount > 0
          ? `Bet ${amount} on ${sideLabel(side)}`
          : `Bet on ${sideLabel(side)}`

  const execute = (input: PlaceBetInput) => {
    const coverage = projection?.lose.coverage ?? 0
    place.mutate(input, {
      onSuccess: (result) => {
        placedToast(input, result, mode, coverage)
        setAmountText("")
        setAllIn(false)
        onDone?.()
      },
      onError: (error) => toast.error(error.message),
    })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (reason || !side || !projection || place.isPending) return
    const input: PlaceBetInput = {
      side,
      amount,
      insure: insureNow,
      allIn: allInBonus,
      rules,
    }
    if (purse - projection.cost < 0) {
      setPledge({ input, cost: projection.cost })
      return
    }
    execute(input)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" aria-describedby={`${ids}-reason`}>
        <SidePicker
          value={side}
          onChange={setPickedSide}
          lockedSide={current?.side ?? null}
          multipliers={{ blue: market.blue_multiplier, red: market.red_multiplier }}
          disabled={place.isPending}
        />

        <StakePicker
          id={`${ids}-stake`}
          label={mode === "raise" ? "Add to your stake" : "Stake"}
          value={amountText}
          onChange={(text) => {
            setAllIn(false)
            setAmountText(text)
          }}
          allIn={allIn}
          onToggleAllIn={() => setAllIn((value) => !value)}
          allInEnabled={allInEnabled}
          allInStake={allInStake}
          purse={balance}
          maxAffordable={maxAdd}
          sliderMax={sliderMax}
          disabled={place.isPending || clock.isExpired}
        />

        {allInBonus && <p className="-mt-2 text-xs text-[var(--color-red-team)]/90">{MARKET_COPY.allInHint}</p>}

        <InsuranceToggle
          id={`${ids}-insurance`}
          rules={rules}
          checked={insure && !allInBonus}
          locked={alreadyInsured}
          onCheckedChange={setInsure}
          disabledReason={insuranceReason}
          premiumNow={premiumQuote}
          coverage={coverageQuote}
          stake={quoteStake}
          otherSide={side ? otherSide(side) : null}
        />

        {early && amount > 0 && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-gold)]">
            <ZapIcon className="size-3.5" aria-hidden />
            Early conviction: this {mode === "raise" ? "raise" : "bet"} earns +{BET_RULES.earlyBonusPct}% on its share of the profit.
          </p>
        )}

        <PayoutPreview side={side} projection={amount > 0 ? projection : null} />

        <div className="space-y-2">
          <p id={`${ids}-reason`} className="min-h-4 text-center text-xs text-muted-foreground" aria-live="polite">
            {reason ?? (projection && projection.cost > 0 ? `Costs ${projection.cost} now${projection.premiumAdd > 0 ? `, including ${projection.premiumAdd} premium` : ""}.` : "")}
          </p>
          <Button
            type="submit"
            disabled={!!reason || place.isPending}
            className="h-12 w-full rounded-xl bg-[var(--color-gold)] text-base font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
          >
            {place.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            {place.isPending ? "Writing it down..." : submitLabel}
          </Button>
          {mode === "raise" && onDone && (
            <Button type="button" variant="ghost" onClick={onDone} className="h-10 w-full text-muted-foreground">
              Keep my bet as it is
            </Button>
          )}
        </div>
      </form>

      <DebtPledgeDialog
        open={!!pledge}
        onOpenChange={(open) => {
          if (!open) setPledge(null)
        }}
        currentBalance={purse}
        cost={pledge?.cost}
        actionLabel={mode === "raise" ? "raise" : "bet"}
        onConfirm={() => {
          if (pledge) execute(pledge.input)
        }}
      />
    </>
  )
}
