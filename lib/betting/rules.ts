// Mirror of bet_rules_v2() in supabase/phase10_betting.sql. The SQL functions settle v2 money; these values
// drive previews, display and the pre-migration fallback. Keep both in sync when tuning.
export const BET_RULES = {
  windowSeconds: 300,
  earlySeconds: 60,
  earlyBonusPct: 10,
  allInBonusPct: 15,
  allInMin: 100,
  premiumPct: 33,
  coveragePct: 60,
  insuranceMin: 10,
  debtFloor: -300,
  maxStake: 100_000,
  legacyPremium: 17,
  legacyCoveragePct: 50,
  whaleAmount: 150,
  lastCallSeconds: 30,
} as const

export const QUICK_STAKES = [10, 25, 50, 100] as const
