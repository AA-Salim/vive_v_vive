"use client"

import { SparklesIcon } from "lucide-react"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { duelTax } from "@/lib/duels/rules"
import { duelLossRefund, duelTithe, effectNotes, noteText, type EffectNote } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

export interface DuelTerms {
  tithe: number
  payout: number
  profit: number
  refund: number
  titheNotes: EffectNote[]
  refundNotes: EffectNote[]
  baseTithe: number
}

// What a duel at this stake pays the viewer once their titles are counted (El Goblino Pequeno, Delayed Victory).
export function useDuelTerms(stake: number): DuelTerms {
  const { fx } = useMyTitleEffects()
  const tithe = duelTithe(stake, fx)
  const refund = duelLossRefund(stake, fx)
  return {
    tithe,
    payout: stake * 2 - tithe,
    profit: stake - tithe,
    refund,
    baseTithe: duelTax(stake),
    titheNotes: tithe !== duelTax(stake) ? effectNotes(fx, "duel_tithe_pct") : [],
    refundNotes: refund > 0 ? effectNotes(fx, "duel_loss_refund_pct") : [],
  }
}

export function DuelTitleChips({ terms, className }: { terms: DuelTerms; className?: string }) {
  const notes = [...terms.titheNotes, ...terms.refundNotes]
  if (notes.length === 0) return null
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {notes.map((note) => (
        <span
          key={`${note.title}:${note.key}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-gold-light)]"
        >
          <SparklesIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
          {noteText(note)}
        </span>
      ))}
    </span>
  )
}
