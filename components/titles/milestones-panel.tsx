"use client"

import { Check, Sparkles } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { TitleBadge } from "@/components/title-badge"
import { EffectLines } from "@/components/titles/effect-lines"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { cn } from "@/lib/utils"
import { tierOf } from "@/lib/titles/catalog"
import { titleEffects } from "@/lib/titles/effects"
import { MILESTONES_HELP, titleHelp } from "@/lib/titles/help"
import { MILESTONE_GROUP_HELP, MILESTONE_GROUPS } from "@/lib/milestones"
import type { MilestoneView } from "@/lib/titles/types"

interface MilestonesPanelProps {
  milestones: MilestoneView[] | undefined
  isLoading: boolean
  error: Error | null
  claimingId: string | null
  claimingAll: boolean
  onClaim: (milestone: MilestoneView) => void
  onClaimAll: () => void
  onRetry: () => void
}

function formatProgress(m: MilestoneView) {
  if (m.stat === "win_rate") return `${m.current.toFixed(1)}% / ${m.threshold}%`
  return `${Math.floor(m.current).toLocaleString("en-US")} / ${m.threshold.toLocaleString("en-US")}`
}

export function MilestonesPanel({ milestones, isLoading, error, claimingId, claimingAll, onClaim, onClaimAll, onRetry }: MilestonesPanelProps) {
  const reduce = useReducedMotion()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error || !milestones) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{error?.message ?? "The milestone scrolls are missing."}</p>
        <Button variant="outline" className="mt-4 h-10" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

  const claimable = milestones.filter((m) => m.unlocked && !m.claimed)
  const engraved = milestones.filter((m) => m.claimed).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
        <p className="flex items-center gap-1 text-sm text-[var(--color-gold-light)]">
          <span className="font-display text-lg text-[var(--color-gold)] tabular-nums">{engraved}</span>
          <span className="text-muted-foreground"> of {milestones.length} engraved</span>
          <InfoTip help={MILESTONES_HELP} side="top" align="start" />
        </p>
        {claimable.length > 0 && (
          <Button className="h-10 gap-2" disabled={claimingAll || claimingId !== null} onClick={onClaimAll}>
            <Sparkles aria-hidden />
            {claimable.length > 1 ? `Claim all (${claimable.length})` : "Claim it"}
          </Button>
        )}
      </div>

      {MILESTONE_GROUPS.map((group) => {
        const items = milestones.filter((m) => m.group === group.key)
        if (items.length === 0) return null
        const help = MILESTONE_GROUP_HELP[group.key]
        return (
          <section key={group.key} aria-labelledby={`milestones-${group.key}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id={`milestones-${group.key}`} className="flex shrink-0 items-center gap-1 font-display text-sm text-[var(--color-gold-light)]">
                {group.label}
                {help && <InfoTip help={help} />}
              </h3>
              <span className="text-right text-[11px] text-muted-foreground">{group.blurb}</span>
            </div>
            <ul className="space-y-2">
              {items.map((m, index) => {
                const pct = Math.min(100, (m.current / m.threshold) * 100)
                const ready = m.unlocked && !m.claimed
                return (
                  <motion.li
                    key={m.id}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: reduce ? 0 : index * 0.03 }}
                    className={cn(
                      "rounded-xl border p-3",
                      m.claimed
                        ? "border-emerald-400/20 bg-emerald-400/[0.04]"
                        : ready
                          ? "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.07] shadow-[0_0_20px_-12px_var(--color-gold)]"
                          : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <TitleBadge
                            name={m.title}
                            category="award"
                            rarity={m.rarity}
                            perk={m.perk}
                            price={0}
                            size="md"
                            interactive
                            className={cn(!m.unlocked && "opacity-60 grayscale-[40%]")}
                          />
                          <TierChip tier={tierOf(m.title, "award")} size="sm" />
                        </span>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5">
                      <InfoTip help={titleHelp({ name: m.title, category: "award", perk: m.perk })} side="top" align="end" />
                      {m.claimed ? (
                        <span className="inline-flex h-10 shrink-0 items-center gap-1 text-xs font-semibold text-emerald-300">
                          <Check aria-hidden className="size-4" />
                          Engraved
                        </span>
                      ) : ready ? (
                        <Button
                          className="h-10 shrink-0 px-4"
                          disabled={claimingAll || claimingId === m.id}
                          onClick={() => onClaim(m)}
                        >
                          Claim
                        </Button>
                      ) : null}
                      </span>
                    </div>
                    <EffectLines effects={titleEffects(m.title)} className="mt-2" emptyLabel={null} />
                    <PerkLine perk={m.perk} className="mt-1.5" />
                    {!m.claimed && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div
                          role="progressbar"
                          aria-label={`${m.title} progress`}
                          aria-valuemin={0}
                          aria-valuemax={m.threshold}
                          aria-valuenow={Math.min(m.current, m.threshold)}
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-navy)]"
                        >
                          <motion.div
                            className={cn("h-full rounded-full", ready ? "bg-[var(--color-gold)]" : "bg-[var(--color-gold)]/40")}
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatProgress(m)}</span>
                      </div>
                    )}
                  </motion.li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
