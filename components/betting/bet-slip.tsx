"use client"

import { useId, useState, type FormEvent } from "react"
import { Loader2Icon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { InsuranceToggle } from "@/components/betting/insurance-toggle"
import { PayoutPreview } from "@/components/betting/payout-preview"
import { SidePicker } from "@/components/betting/side-picker"
import { StakePicker } from "@/components/betting/stake-picker"
import { usePlaceBet, type Market } from "@/components/betting/use-market"
import { TitleInPlay } from "@/components/titles/title-in-play"
import type { MarketClock } from "@/components/betting/use-clock"
import { noteChips, TitleChipRow } from "@/components/chaos/title-chips"
import { MARKET_COPY } from "@/lib/betting/copy"
import { allInHelp, betHelp, earlyHelp } from "@/lib/betting/help"
import { maxAffordableAdd, otherSide, projectBet, sideLabel } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import { BASE_BET_TERMS, type BetTitleTerms } from "@/lib/betting/title-terms"
import type { PlaceBetInput, PlaceBetResult } from "@/lib/betting/types"
import { noteText, parseNotes } from "@/lib/titles/effects"
import type { Side } from "@/lib/types"

const NO_POOLS = { blue: 0, red: 0 }

interface BetSlipProps {
  sessionId: string
  market: Market
  userId: string
  balance: number | null
  balanceLoading: boolean
  clock: MarketClock
  mode: "new" | "raise"
  terms?: BetTitleTerms
  onDone?: () => void
  // Sides the viewer may not back, with the reason shown on the slip. Wire it when the server enforces a side rule.
}

function placedToast(input: PlaceBetInput, result: PlaceBetResult, mode: "new" | "raise", coverage: number, terms: BetTitleTerms) {
  const side = sideLabel(input.side)
  const total = typeof result.bet?.amount === "number" ? result.bet.amount : result.staked
  const lines: string[] = []
  if (result.early) lines.push(`Early conviction locked: +${BET_RULES.earlyBonusPct}% on profit.`)
  if (result.all_in) lines.push(`All-in. +${terms.allInBonusPct}% on profit if you are right. If not, the court will hear about it.`)
  if (result.premium > 0) {
    lines.push(
      result.rules === 2
        ? `Guardian Angel hired: ${coverage} comes back if ${sideLabel(otherSide(input.side))} wins.`
        : `Insured for ${result.premium}: half your stake back if you lose.`
    )
  }
  for (const note of parseNotes(result.title_effects)) {
    lines.push(`${noteText(note)}.`)
  }
  toast.success(mode === "raise" ? `Raised to ${total} on ${side}.` : `${total} on ${side}. Written in the notebook.`, {
    description: lines.join(" ") || undefined,
  })
}

export function BetSlip({ sessionId, market, userId, balance, balanceLoading, clock, mode, terms = BASE_BET_TERMS, onDone }: BetSlipProps) {
  const ids = useId()
  const rules = market.rules_version
  const current = mode === "raise" ? market.user_bet : null
  const [pickedSide, setPickedSide] = useState<Side | null>(null)
  const [amountText, setAmountText] = useState("")
  const [allIn, setAllIn] = useState(false)
  const [insure, setInsure] = useState(false)
  const [pledge, setPledge] = useState<{ input: PlaceBetInput; cost: number } | null>(null)
  const place = usePlaceBet(sessionId, userId)

  const ownSide = market.viewer_side ?? null
  const side = current?.side ?? ownSide ?? pickedSide
  const purse = balance ?? 0
  const allInStake = Math.max(purse, 0)
  const amount = allIn ? allInStake : Number.parseInt(amountText, 10) || 0
  const allInBonus = allIn && rules === 2
  const alreadyInsured = !!current?.insured
  const titled = rules === 2
  const insuranceRefused = titled && terms.insuranceBlocked && !alreadyInsured
  const insureNow = !allInBonus && (alreadyInsured || (insure && !insuranceRefused))
  const early = rules === 2 && clock.isEarly

  // Title terms only exist under the v2 rules; before a side is picked, premiums are quoted at the even-odds floor.
  const project = (add: number, withInsurance: boolean) =>
    projectBet({
      rules,
      side: side ?? "blue",
      pools: side ? { blue: market.blue_total, red: market.red_total } : NO_POOLS,
      current,
      add,
      early,
      allIn: allInBonus,
      insure: withInsurance,
      terms: titled ? terms : BASE_BET_TERMS,
    })
  const projection = side ? project(amount, insureNow) : null
  const insuredQuote = project(amount, true)

  const currentStake = current?.amount ?? 0
  const cap = titled ? terms.cap : null
  const capRoom = cap == null ? Number.POSITIVE_INFINITY : Math.max(0, cap - currentStake)
  const notes = titled ? terms.notesFor(side ?? "blue") : []
  const noteOf = (key: (typeof notes)[number]["key"]) => notes.filter((n) => n.key === key)
  const capLine = noteOf("bet_cap").map(noteText)[0] ?? null

  const maxAdd = Math.min(maxAffordableAdd(purse, (add) => project(add, insureNow).cost), capRoom)
  const sliderMax = purse > 0 ? Math.min(purse, maxAdd) : maxAdd
  const stakeAfter = currentStake + amount
  const allInEnabled =
    rules === 2
      ? purse >= 1 && currentStake + purse >= BET_RULES.allInMin && !alreadyInsured && (cap == null || currentStake + purse <= cap)
      : purse >= 1

  const insuranceReason = insuranceRefused
    ? `No insurance: ${noteOf("insurance_blocked").map((n) => n.title).join(", ") || "a curse"} burns on you.`
    : allInBonus
      ? "All-in bets cannot be insured. Die with your boots on."
      : !alreadyInsured && rules === 2 && amount > 0 && stakeAfter < BET_RULES.insuranceMin
        ? `Covers stakes of ${BET_RULES.insuranceMin} or more.`
        : null
  const quoteStake = stakeAfter > 0 ? stakeAfter : 0

  const reason = clock.isExpired
    ? "Betting has closed."
    : balanceLoading
      ? "Reading your purse..."
      : !side
        ? "Pick a side first."
        : ownSide && side !== ownSide
          ? `You play for ${sideLabel(ownSide)}. A bet on ${sideLabel(side)} would be treason.`
          : amount < 1
            ? allIn
              ? "Your purse is empty. Nothing to shove."
              : mode === "raise"
                ? capRoom === 0 && capLine
                  ? `${capLine}. Your stake is already at the cap.`
                  : "Choose how much to add."
                : "Choose a stake."
            : cap != null && stakeAfter > cap
              ? `${capLine ?? `Bets capped at ${cap} a game`}. You can put in at most ${capRoom}.`
            : allInBonus && stakeAfter < BET_RULES.allInMin
              ? `All-in needs at least ${BET_RULES.allInMin} points on the line.`
              : insureNow && rules === 2 && stakeAfter < BET_RULES.insuranceMin
                ? `The Guardian Angel covers stakes of ${BET_RULES.insuranceMin} or more.`
                : projection && projection.cost > purse - BET_RULES.debtFloor
                  ? maxAdd > 0
                    ? `Over the debt limit. You can put in at most ${maxAdd}.`
                    : `Debt limit reached (${BET_RULES.debtFloor}). Even Salaxe's notebook has a last page.`
                  : null
  const capChips = noteChips(noteOf("bet_cap"), "slip-cap")
  const insuranceChips = noteChips(
    [...noteOf("insurance_blocked"), ...noteOf("insurance_coverage_bonus"), ...noteOf("insurance_premium_salaxe_pct")],
    "slip-insurance"
  )
  const allInChips = noteChips(noteOf("all_in_bonus_pct"), "slip-all-in")
  const earlyChips = noteChips(noteOf("early_window_bonus_s"), "slip-early")

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
        placedToast(input, result, mode, coverage, titled ? terms : BASE_BET_TERMS)
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
      current: current?.amount ?? 0,
      maxPremium: rules === 2 ? projection.premiumAdd : null,
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
          ownSide={ownSide}
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
          allInHelp={allInHelp(rules, balance, allInBonus && projection ? projection.win.allIn : 0)}
          disabled={place.isPending || clock.isExpired}
        />

        {capChips.length > 0 && (
          <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-rose-200/85">
            <TitleChipRow chips={capChips} label="Stake cap" />
            <span>
              {capRoom > 0 ? `${capRoom} more allowed on this game.` : "Your stake is at the cap for this game."}
            </span>
          </div>
        )}

        {allInBonus && (
          <div className="-mt-2 space-y-1">
            <p className="text-xs text-[var(--color-red-team)]/90">
              {allInChips.length > 0
                ? `Stake your whole purse (${BET_RULES.allInMin}+). Win: +${terms.allInBonusPct}% on profit. Lose: the court hears about it.`
                : MARKET_COPY.allInHint}
            </p>
            <TitleChipRow chips={allInChips} label="All-in title" />
          </div>
        )}

        <InsuranceToggle
          id={`${ids}-insurance`}
          rules={rules}
          checked={insure && !allInBonus && !insuranceRefused}
          locked={alreadyInsured}
          onCheckedChange={setInsure}
          disabledReason={insuranceReason}
          premiumNow={insuredQuote.premiumAdd}
          premiumPct={insuredQuote.premiumPct}
          coverage={insuredQuote.lose.coverage}
          stake={quoteStake}
          otherSide={side ? otherSide(side) : null}
          terms={titled ? terms : BASE_BET_TERMS}
          titleChips={insuranceChips}
        />

        {early && amount > 0 && (
          <div className="space-y-1">
            <div className="flex items-start gap-1.5 text-xs font-medium text-[var(--color-gold)]">
              <ZapIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1">
                Early conviction: this {mode === "raise" ? "raise" : "bet"} earns +{BET_RULES.earlyBonusPct}% on its share of the profit.
              </p>
              <InfoTip help={earlyHelp(projection?.win.early ?? 0)} align="end" className="-my-0.5" />
            </div>
            <TitleChipRow chips={earlyChips} label="Early window title" />
          </div>
        )}

        <TitleInPlay userId={userId} context="bet" />

        <PayoutPreview
          side={side}
          projection={amount > 0 ? projection : null}
          allInPct={titled ? terms.allInBonusPct : BET_RULES.allInBonusPct}
        />

        <div className="space-y-2">
          <div className="flex min-h-5 items-center justify-center gap-1">
            <p id={`${ids}-reason`} className="text-center text-xs text-muted-foreground" aria-live="polite">
              {reason ?? (projection && projection.cost > 0 ? `Costs ${projection.cost} now${projection.premiumAdd > 0 ? `, including ${projection.premiumAdd} premium` : ""}.` : "")}
            </p>
            <InfoTip help={betHelp({ rules, mode, side, projection })} />
          </div>
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
