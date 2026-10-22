"use client"

import { ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { Switch } from "@/components/ui/switch"
import { TitleChipRow, type TitleChipModel } from "@/components/chaos/title-chips"
import { MARKET_COPY } from "@/lib/betting/copy"
import { guardianHelp } from "@/lib/betting/help"
import { otherSide as flip, sideLabel } from "@/lib/betting/math"
import { BET_RULES } from "@/lib/betting/rules"
import { BASE_BET_TERMS, type BetTitleTerms } from "@/lib/betting/title-terms"
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
  terms?: BetTitleTerms
  titleChips?: TitleChipModel[]
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
  terms = BASE_BET_TERMS,
  titleChips = [],
}: InsuranceToggleProps) {
  const on = checked || locked
  const loser = otherSide ? sideLabel(otherSide) : "the other side"
  const rate = premiumPct > 0 ? ` (${premiumPct}%)` : ""
  const floorPct = otherSide ? terms.premiumPct(BET_RULES.premiumPct, flip(otherSide)) : BET_RULES.premiumPct
  const quote =
    stake <= 0
      ? rules === 2
        ? `From ${floorPct}% of your stake, more for a long shot. Returns ${terms.coveragePct}% if your side loses.`
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
            <InfoTip
              help={guardianHelp({
                rules,
                stake,
                premium: premiumNow,
                pct: premiumPct,
                coverage,
                loser: otherSide,
                raising: locked,
                coveragePct: terms.coveragePct,
                titleLines: titleChips.map((chip) => chip.detail ?? chip.label),
              })}
              align="start"
            />
          </div>
          <p id={`${id}-quote`} className="text-xs leading-snug text-muted-foreground">
            {disabledReason ?? quote}
          </p>
          {rules === 2 && <TitleChipRow chips={titleChips} size="xs" className="mt-1" label="Guardian Angel titles" />}
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
