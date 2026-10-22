"use client"

import { motion, useReducedMotion } from "motion/react"
import { CheckIcon, CoinsIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { rewardCopy } from "@/lib/lore/rewards"
import { cn } from "@/lib/utils"

export interface UnclaimedAward {
  id: string
  category: string
  title: string
  carry_over_bonus: number
  final_value: string | null
  acts: { act_number: number; name: string } | null
  is_consolation?: boolean
}

export interface AwardGroup {
  key: string
  title: string
  ids: string[]
  categories: string[]
  bonus: number
  finalValue: string | null
  actNumber: number
  consolation: boolean
}

// Two categories can grant the same title (treasury and grand champion): they are claimed as one honor.
export function groupAwards(awards: UnclaimedAward[]): AwardGroup[] {
  const groups = new Map<string, AwardGroup>()
  for (const award of awards) {
    const actNumber = award.acts?.act_number ?? 1
    const key = `${actNumber}:${award.title}`
    const group = groups.get(key) ?? {
      key,
      title: award.title,
      ids: [],
      categories: [],
      bonus: 0,
      finalValue: award.final_value,
      actNumber,
      consolation: !!award.is_consolation,
    }
    group.ids.push(award.id)
    if (!group.categories.includes(award.category)) group.categories.push(award.category)
    group.bonus += Math.max(0, award.carry_over_bonus)
    group.finalValue ??= award.final_value
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.bonus - a.bonus || a.title.localeCompare(b.title))
}

interface RewardCardProps {
  group: AwardGroup
  engraved: boolean
  claiming: boolean
  disabled: boolean
  onClaim: () => void
}

export function RewardCard({ group, engraved, claiming, disabled, onClaim }: RewardCardProps) {
  const reduceMotion = useReducedMotion() ?? false
  const copy = rewardCopy(group.categories[0] ?? "consolation")
  const labels = group.categories.map((c) => rewardCopy(c).label).join(" · ")

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-colors duration-500",
        engraved
          ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/8"
          : group.consolation
            ? "border-border bg-[var(--color-navy-light)]"
            : "border-[var(--color-gold)]/25 bg-[var(--color-navy-light)]"
      )}
    >
      {engraved && !reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-[var(--color-gold-light)]/20 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "420%" }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-semibold tracking-[0.18em] uppercase",
              group.consolation ? "text-muted-foreground" : "text-[var(--color-gold)]"
            )}
          >
            {labels}
          </p>
          <p className="mt-1 font-display text-lg leading-snug font-semibold text-balance break-words text-foreground">
            {group.consolation ? `"${group.title}"` : group.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{engraved ? copy.engraved : copy.flavor}</p>
          {group.finalValue && !engraved && (
            <p className="mt-2 inline-flex h-6 items-center rounded-full border border-border px-2 text-[11px] text-[var(--color-gold-light)]/80 tabular-nums">
              {group.finalValue.replace(/^1 times\b/, "1 time")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {group.bonus > 0 && (
            <span className="inline-flex items-center gap-1 font-display text-lg font-semibold text-[var(--color-gold)] tabular-nums">
              <CoinsIcon className="size-4" aria-hidden />+{group.bonus}
            </span>
          )}
          {engraved ? (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--color-gold)]">
              <CheckIcon className="size-4" aria-hidden />
              Engraved
            </span>
          ) : (
            <Button
              onClick={onClaim}
              disabled={disabled}
              aria-label={`Claim ${group.title}`}
              className={cn(
                "h-10 min-w-24 font-semibold",
                group.consolation
                  ? "bg-muted text-foreground hover:bg-muted/70"
                  : "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
              )}
            >
              {claiming ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              {claiming ? "Engraving" : group.consolation ? "Accept" : "Claim"}
            </Button>
          )}
        </div>
      </div>
    </motion.li>
  )
}
