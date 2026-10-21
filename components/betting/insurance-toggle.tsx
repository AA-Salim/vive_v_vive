"use client"

import { InfoIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { MARKET_COPY } from "@/lib/betting/copy"
import { sideLabel } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import type { RulesVersion } from "@/lib/betting/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface InsuranceToggleProps {
  id: string
  rules: RulesVersion
  checked: boolean
  locked: boolean
  onCheckedChange: (checked: boolean) => void
  disabledReason: string | null
  premiumNow: number
  premiumPct: number
  coverage: number
  stake: number
  otherSide: Side | null
}

export function InsuranceTerms({ rules }: { rules: RulesVersion }) {
  if (rules === 1) {
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        <p className="font-semibold text-[var(--color-gold)]">Insurance (current rules)</p>
        <p>Flat {BET_RULES.legacyPremium} points. Lose, and half your stake comes back. Win, and the {BET_RULES.legacyPremium} is refunded.</p>
      </div>
    )
  }
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      <p className="font-semibold text-[var(--color-gold)]">{MARKET_COPY.insuranceTitle}: the exact terms</p>
      <p>
        <span className="font-semibold">Premium:</span> priced from the pool the moment you buy. {BET_RULES.premiumPct}% of your stake
        at even odds or as the favorite, more for a long shot, up to {BET_RULES.premiumMaxPct}%. Paid now, kept by the house if you win.
      </p>
      <p>
        <span className="font-semibold">Coverage:</span> {BET_RULES.coveragePct}% of your stake, rounded down, paid only if your side loses.
      </p>
      <p>
        Raising an insured bet insures the new points at the current price. Stakes of {BET_RULES.insuranceMin}+ only. All-in bets cannot
        be insured.
      </p>
      <p>Canceled game or nobody on the other side: stake and premium both come back.</p>
      <p className="text-muted-foreground">Priced so it never pays for itself on average. It buys peace of mind, not profit.</p>
    </div>
  )
}

export function InsuranceToggle({
  id,
  rules,
  checked,
  locked,
  onCheckedChange,
  disabledReason,
  premiumNow,
  premiumPct,
  coverage,
  stake,
  otherSide,
}: InsuranceToggleProps) {
  const on = checked || locked
  const loser = otherSide ? sideLabel(otherSide) : "the other side"
  const rate = premiumPct > 0 ? ` (${premiumPct}%)` : ""
  const quote =
    stake <= 0
      ? rules === 2
        ? `From ${BET_RULES.premiumPct}% of your stake, more for a long shot. Returns ${BET_RULES.coveragePct}% if your side loses.`
        : `Costs ${BET_RULES.legacyPremium}. Returns half your stake if you lose, refunded if you win.`
      : locked
        ? premiumNow > 0
          ? `Covers the raise for ${premiumNow} more${rate}. If ${loser} wins, ${coverage} comes back.`
          : `Insured. If ${loser} wins, ${coverage} comes back.`
        : rules === 2
          ? `Pay ${premiumNow} now${rate}. If ${loser} wins, ${coverage} of your ${stake} comes back.`
          : `Pay ${premiumNow} now. If ${loser} wins, ${coverage} comes back. Refunded if you win.`

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        on ? "border-emerald-400/40 bg-emerald-400/10" : "border-border bg-[var(--color-navy)]/40"
      )}
    >
      <div className="flex items-center gap-3">
        {on ? (
          <ShieldCheckIcon className="size-5 shrink-0 text-emerald-300" aria-hidden />
        ) : (
          <ShieldIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-[var(--color-gold-light)]">
              {rules === 2 ? MARKET_COPY.insuranceTitle : "Insurance"}
            </label>
            <Popover>
              <PopoverTrigger
                openOnHover
                delay={150}
                aria-label="Insurance terms"
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-[var(--color-gold)] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <InfoIcon className="size-3.5" aria-hidden />
              </PopoverTrigger>
              <PopoverContent side="top" className="w-80 max-w-[calc(100vw-2rem)] border border-[var(--color-gold)]/20">
                <InsuranceTerms rules={rules} />
              </PopoverContent>
            </Popover>
          </div>
          <p id={`${id}-quote`} className="text-xs leading-snug text-muted-foreground">
            {disabledReason ?? quote}
          </p>
        </div>
        <Switch
          id={id}
          checked={on}
          disabled={locked || (!!disabledReason && !checked)}
          onCheckedChange={(value) => onCheckedChange(value)}
          aria-describedby={`${id}-quote`}
          className="data-checked:bg-emerald-500"
        />
      </div>
    </div>
  )
}
