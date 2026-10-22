"use client"

import { SparklesIcon } from "lucide-react"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { PRAISE_REWARD, ROYAL_FAVOR } from "@/lib/praise/rules"
import {
  EFFECT_KEYS,
  effectNotes,
  favorReward,
  noteChip,
  noteText,
  parseNotes,
  praiseReward,
  type EffectKey,
  type EffectNote,
} from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

export interface PraiseTerms {
  base: number
  reward: number
  favor: number
  rewardNotes: EffectNote[]
  favorNotes: EffectNote[]
  rewardCapped: boolean
  favorCapped: boolean
}

// What the viewer's titles make a praise and a crown pay, from the shared effect formulas. base is the reward the
// live rules pay (PraiseStateReady.reward).
export function usePraiseTerms(base: number = PRAISE_REWARD): PraiseTerms {
  const { fx } = useMyTitleEffects()
  return {
    base,
    reward: praiseReward(fx, base),
    favor: favorReward(fx),
    rewardNotes: effectNotes(fx, "praise_bonus_pct"),
    favorNotes: effectNotes(fx, "favor_bonus_pct"),
    rewardCapped: !!fx.get("praise_bonus_pct")?.capped,
    favorCapped: !!fx.get("favor_bonus_pct")?.capped,
  }
}

const CAPPED: Partial<Record<EffectKey, string>> = {
  praise_bonus_pct: `capped at +${EFFECT_KEYS.praise_bonus_pct.max}%`,
  favor_bonus_pct: `capped at +${EFFECT_KEYS.favor_bonus_pct.max}%`,
}

interface TitleBonusChipsProps {
  notes: EffectNote[]
  capped?: boolean
  className?: string
}

// One chip per title that changes the amount: "Last Loyalist +25% praise".
export function TitleBonusChips({ notes, capped = false, className }: TitleBonusChipsProps) {
  if (notes.length === 0) return null
  const key = notes[0].key
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {notes.map((note) => (
        <span
          key={`${note.title}:${note.key}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-gold-light)]"
        >
          <SparklesIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
          {noteChip(note)}
        </span>
      ))}
      {capped && CAPPED[key] && <span className="text-[10px] text-muted-foreground">({CAPPED[key]})</span>}
    </span>
  )
}

// The base reward struck through next to the boosted one, so the bonus reads at a glance.
export function BoostedAmount({ value, base, className }: { value: number; base: number; className?: string }) {
  if (value === base) return <span className={className}>+{value}</span>
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-[0.8em] font-normal line-through opacity-60">+{base}</span>
      <span>+{value}</span>
    </span>
  )
}

export const PRAISE_BASE = { reward: PRAISE_REWARD, favor: ROYAL_FAVOR } as const

// What POST /api/praise says the titles did (titleEffects: notes or ready-made lines). Older servers send nothing.
export function submittedEffectLines(result: unknown): string[] {
  if (!result || typeof result !== "object") return []
  const raw = (result as { titleEffects?: unknown }).titleEffects
  if (!Array.isArray(raw)) return []
  const notes = parseNotes(raw)
  if (notes.length > 0) return notes.map(noteText)
  return raw.filter((line): line is string => typeof line === "string" && line.length > 0).slice(0, 4)
}
