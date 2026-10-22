"use client"

import { AnimatedNumber } from "@/components/betting/animated-number"
import { InfoTip } from "@/components/ui/info-tip"
import { payoutHelp } from "@/lib/betting/help"
import { formatSigned, otherSide, sideLabel, type Projection } from "@/lib/betting/math"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PayoutPreviewProps {
  side: Side | null
  projection: Projection | null
  exact?: boolean
  // The all-in bonus rate this bettor gets (The 0/8 Powerspike raises it).
  allInPct?: number
}

export function outcomeTone(value: number): string {
  if (value > 0) return "text-emerald-300"
  if (value < 0) return "text-rose-300"
  return "text-[var(--color-gold-light)]/80"
}

function Breakdown({ parts }: { parts: Array<[string, number]> }) {
  const visible = parts.filter(([, value]) => value !== 0)
  if (visible.length < 2) return null
  return (
    <p className="text-[11px] tabular-nums text-muted-foreground">
      {visible.map(([label, value], i) => (
        <span key={label}>
          {i > 0 && " · "}
          {label} {formatSigned(value)}
        </span>
      ))}
    </p>
  )
}

export function PayoutPreview({ side, projection, exact = false, allInPct }: PayoutPreviewProps) {
  if (!side || !projection || projection.stake <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
        Pick a side and a stake to see what the notebook owes you.
      </div>
    )
  }

  const other = otherSide(side)
  const { win, lose } = projection

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-gold)]/15 bg-[var(--color-navy)]/50 p-3">
      <p className="sr-only" aria-live="polite">
        {projection.oneSided
          ? `Nobody is on ${sideLabel(other)} yet.`
          : `If ${sideLabel(side)} wins: ${formatSigned(win.net)} points. If ${sideLabel(other)} wins: ${formatSigned(lose.net)} points.`}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {exact ? "Final odds" : "If the notebook closed now"}
        </span>
        <InfoTip help={payoutHelp(side, projection, exact)} align="end" className="-my-1" />
      </div>

      {projection.oneSided ? (
        <p className="text-xs text-[var(--color-gold-light)]/80">
          Nobody is on {sideLabel(other)} yet. If it stays that way, every stake is refunded.
        </p>
      ) : (
        <>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-[var(--color-gold-light)]/80">If {sideLabel(side)} wins</span>
              <span className="flex items-baseline gap-2">
                <AnimatedNumber value={win.net} format={formatSigned} className={cn("font-display text-lg font-semibold tabular-nums", outcomeTone(win.net))} />
                <span className="text-xs tabular-nums text-muted-foreground">x{win.effective.toFixed(2)}</span>
              </span>
            </div>
            <Breakdown
              parts={[
                ["pool", win.profit],
                ["early", win.early],
                [allInPct ? `all-in ${allInPct}%` : "all-in", win.allIn],
                ["premium", -win.premiumKept],
              ]}
            />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-[var(--color-gold-light)]/80">If {sideLabel(other)} wins</span>
              <AnimatedNumber value={lose.net} format={formatSigned} className={cn("font-display text-lg font-semibold tabular-nums", outcomeTone(lose.net))} />
            </div>
            {lose.coverage > 0 && (
              <p className="text-[11px] text-emerald-300/80">
                {projection.legacyTerms ? "Insurance" : "Guardian Angel"} returns {lose.coverage}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
