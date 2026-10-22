import { BET_RULES } from "@/lib/betting/rules"
import { BASE_BET_TERMS, type BetTitleTerms } from "@/lib/betting/title-terms"
import type { BetRow, RulesVersion } from "@/lib/betting/types"
import type { Side } from "@/lib/types"

export function otherSide(side: Side): Side {
  return side === "blue" ? "red" : "blue"
}

export function sideLabel(side: Side): string {
  return side === "blue" ? "Blue" : "Red"
}

export function multiplier(total: number, sidePool: number): number | null {
  return sidePool > 0 ? total / sidePool : null
}

export function formatMultiplier(value: number | null): string {
  return value == null ? "x--" : `x${value.toFixed(2)}`
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `-${Math.abs(value)}`
  return "0"
}

// Pari-mutuel share of the whole pool, floored exactly like resolve_bets_v2.
export function poolPayout(stake: number, sidePool: number, total: number): number {
  if (sidePool <= 0) return stake
  return Math.floor((stake * total) / sidePool)
}

// Mirrors bet_v2_premium_pct(): the other side's share of the pool is the implied chance of losing, so long
// shots cost more to insure. sidePool must already include the stake being insured.
export function premiumPctFor(sidePool: number, otherPool: number): number {
  if (otherPool <= 0 || sidePool <= 0) return BET_RULES.premiumPct
  const scaled = Math.ceil(
    (BET_RULES.coveragePct * BET_RULES.premiumLoadPct * otherPool) / (100 * (sidePool + otherPool))
  )
  return Math.min(Math.max(scaled, BET_RULES.premiumPct), BET_RULES.premiumMaxPct)
}

export function premiumFor(stake: number, pct: number): number {
  return Math.ceil((stake * pct) / 100)
}

export function coverageFor(stake: number, pct: number): number {
  return Math.floor((stake * pct) / 100)
}

export function earlyBonusFor(profit: number, stake: number, earlyAmount: number): number {
  if (profit <= 0 || earlyAmount <= 0 || stake <= 0) return 0
  return Math.floor((profit * BET_RULES.earlyBonusPct * Math.min(earlyAmount, stake)) / (100 * stake))
}

export function allInBonusFor(profit: number, pct: number = BET_RULES.allInBonusPct): number {
  return profit > 0 ? Math.floor((profit * pct) / 100) : 0
}

export type ExistingStake = Pick<
  BetRow,
  "amount" | "premium" | "early_amount" | "insured" | "coverage_pct" | "scheme" | "all_in"
>

export interface ProjectionInput {
  rules: RulesVersion
  side: Side
  pools: { blue: number; red: number }
  current: ExistingStake | null
  add: number
  early: boolean
  allIn: boolean
  insure: boolean
  // The bettor's title effects (coverage, premium, all-in bonus); the base rules when absent.
  terms?: BetTitleTerms
}

export interface Projection {
  stake: number
  add: number
  cost: number
  premiumAdd: number
  premiumTotal: number
  premiumPct: number
  insured: boolean
  allIn: boolean
  legacyTerms: boolean
  oneSided: boolean
  multiplier: number | null
  win: { payout: number; profit: number; early: number; allIn: number; premiumKept: number; net: number; effective: number }
  lose: { coverage: number; premiumKept: number; net: number }
}

export function usesLegacyTerms(rules: RulesVersion, current: ExistingStake | null): boolean {
  return rules === 1 || (!!current && current.scheme === "legacy" && current.insured)
}

export function projectBet(input: ProjectionInput): Projection {
  const { rules, side, pools, current, early, insure } = input
  const terms = input.terms ?? BASE_BET_TERMS
  const add = Math.max(0, Math.floor(input.add))
  const legacyTerms = usesLegacyTerms(rules, current)
  const stake = (current?.amount ?? 0) + add
  const sidePool = (side === "blue" ? pools.blue : pools.red) + add
  const otherPool = side === "blue" ? pools.red : pools.blue
  const total = sidePool + otherPool
  const oneSided = otherPool <= 0
  const wasInsured = !!current?.insured
  const insured = wasInsured || insure
  const allIn = !legacyTerms && (!!current?.all_in || input.allIn)

  let premiumTotal = 0
  let premiumAdd = 0
  let premiumPct = 0
  let coverage = 0
  if (insured && stake > 0) {
    if (legacyTerms) {
      premiumTotal = BET_RULES.legacyPremium
      premiumAdd = wasInsured ? 0 : BET_RULES.legacyPremium
      coverage = coverageFor(stake, BET_RULES.legacyCoveragePct)
    } else {
      premiumPct = terms.premiumPct(premiumPctFor(sidePool, otherPool), side)
      premiumAdd = premiumFor(wasInsured ? add : stake, premiumPct)
      premiumTotal = (current?.premium ?? 0) + premiumAdd
      coverage = coverageFor(stake, current?.insured && current.coverage_pct > 0 ? current.coverage_pct : terms.coveragePct)
    }
  }

  const payout = oneSided ? stake : poolPayout(stake, sidePool, total)
  const profit = Math.max(payout - stake, 0)
  const earlyAmount = (current?.early_amount ?? 0) + (early ? add : 0)
  const earlyBonus = legacyTerms ? 0 : earlyBonusFor(profit, stake, earlyAmount)
  const allInBonus = allIn ? allInBonusFor(profit, terms.allInBonusPct) : 0
  const winPremiumKept = legacyTerms ? 0 : premiumTotal

  return {
    stake,
    add,
    cost: add + premiumAdd,
    premiumAdd,
    premiumTotal,
    premiumPct,
    insured,
    allIn,
    legacyTerms,
    oneSided,
    multiplier: multiplier(total, sidePool),
    win: {
      payout,
      profit,
      early: earlyBonus,
      allIn: allInBonus,
      premiumKept: winPremiumKept,
      net: oneSided ? 0 : profit + earlyBonus + allInBonus - winPremiumKept,
      effective: stake > 0 ? (payout + earlyBonus + allInBonus) / stake : 0,
    },
    lose: {
      coverage,
      premiumKept: premiumTotal,
      net: oneSided ? 0 : coverage - stake - premiumTotal,
    },
  }
}

// Largest extra stake that keeps the balance above the debt floor once the premium is included. The result is
// always affordable; a pool-priced premium can step down as the stake grows, so it may sit a point under the
// true maximum.
export function maxAffordableAdd(balance: number, costOf: (add: number) => number): number {
  const budget = balance - BET_RULES.debtFloor
  if (budget <= 0) return 0
  let lo = 0
  let hi = Math.min(budget, BET_RULES.maxStake)
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (costOf(mid) <= budget) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function betNet(bet: Pick<BetRow, "status" | "amount" | "payout" | "insured" | "scheme" | "premium">): number | null {
  if (bet.status === "pending") return null
  if (bet.status === "refunded") return 0
  const payout = bet.payout ?? 0
  if (bet.scheme === "v2") return payout - bet.amount - bet.premium
  const keptPremium = bet.insured && bet.status === "lost" ? BET_RULES.legacyPremium : 0
  return payout - bet.amount - keptPremium
}

export interface BreakdownLine {
  label: string
  value: number
}

// Rebuilds the payout components of a settled bet from its stored payout, bonus and premium.
// A bet with no early stake owes its whole bonus to the all-in, whatever the title-raised all-in rate was.
export function settledBreakdown(
  bet: Pick<BetRow, "status" | "amount" | "payout" | "insured" | "scheme" | "premium" | "bonus" | "all_in"> &
    Partial<Pick<BetRow, "early_amount">>
): BreakdownLine[] {
  if (bet.status === "won") {
    const base = (bet.payout ?? 0) - bet.bonus
    const profit = base - bet.amount
    const allIn = !bet.all_in ? 0 : bet.early_amount === 0 ? bet.bonus : Math.min(allInBonusFor(profit), bet.bonus)
    const early = Math.max(bet.bonus - allIn, 0)
    const lines: BreakdownLine[] = [{ label: "Pool profit", value: profit }]
    if (early > 0) lines.push({ label: "Early conviction", value: early })
    if (allIn > 0) lines.push({ label: "All-in bonus", value: allIn })
    if (bet.scheme === "v2" && bet.premium > 0) lines.push({ label: "Guardian Angel premium", value: -bet.premium })
    return lines
  }
  if (bet.status === "lost") {
    const lines: BreakdownLine[] = [{ label: "Stake", value: -bet.amount }]
    if (bet.insured) {
      lines.push({ label: bet.scheme === "v2" ? "Guardian Angel returned" : "Insurance returned", value: bet.payout ?? 0 })
      lines.push({ label: "Premium", value: -(bet.scheme === "v2" ? bet.premium : BET_RULES.legacyPremium) })
    }
    return lines
  }
  return []
}
