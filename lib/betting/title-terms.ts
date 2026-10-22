import { BET_RULES } from "@/lib/betting/rules"
import {
  allInBonusPct,
  betCap,
  coveragePct,
  earlySeconds,
  effectNotes,
  insuranceBlocked,
  premiumPct,
  type CombinedEffects,
  type EffectNote,
} from "@/lib/titles/effects"
import type { Side } from "@/lib/types"

// Title effects on bets, shared by the slip and the pre-migration fallback. Mirrors the vvv_title_* bet helpers in
// supabase/phase10_title-effects.sql (cap and insurance refusal, Holdout premium, Copium coverage, Crown Thief window,
// 0/8 all-in bonus).

export interface BetTitleTerms {
  // Most a bettor may have on one game, all-in included; null when no curse caps it.
  cap: number | null
  insuranceBlocked: boolean
  coveragePct: number
  allInBonusPct: number
  earlySeconds: number
  // Turns the pool-priced premium into the bettor's premium for a side.
  premiumPct: (basePct: number, side: Side) => number
  // The notes for the effects that differ from the base rules on this side.
  notesFor: (side: Side) => EffectNote[]
}

export interface BetTitleContext {
  salaxeSide: Side | null
  isSalaxe: boolean
}

export function betTitleTerms(fx: CombinedEffects, ctx: BetTitleContext): BetTitleTerms {
  const backs = (side: Side) => ctx.salaxeSide !== null && side === ctx.salaxeSide
  return {
    cap: betCap(fx),
    insuranceBlocked: insuranceBlocked(fx),
    coveragePct: coveragePct(fx),
    allInBonusPct: allInBonusPct(fx),
    earlySeconds: earlySeconds(fx),
    premiumPct: (basePct, side) => premiumPct(basePct, fx, backs(side), ctx.isSalaxe),
    notesFor: (side) => [
      ...effectNotes(fx, "bet_cap"),
      ...effectNotes(fx, "insurance_blocked"),
      ...effectNotes(fx, "insurance_coverage_bonus"),
      ...(backs(side) && !ctx.isSalaxe ? effectNotes(fx, "insurance_premium_salaxe_pct") : []),
      ...effectNotes(fx, "all_in_bonus_pct"),
      ...effectNotes(fx, "early_window_bonus_s"),
    ],
  }
}

export const BASE_BET_TERMS: BetTitleTerms = {
  cap: null,
  insuranceBlocked: false,
  coveragePct: BET_RULES.coveragePct,
  allInBonusPct: BET_RULES.allInBonusPct,
  earlySeconds: BET_RULES.earlySeconds,
  premiumPct: (basePct) => basePct,
  notesFor: () => [],
}
