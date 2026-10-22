// Mirror of bounty_rules() and pillory_rules() in supabase/phase10_bounties-shame.sql. The SQL functions move
// the money; these values drive previews, copy and validation. Keep both in sync when tuning.
export const BOUNTY_RULES = {
  minPledge: 20,
  maxBackerTotal: 500,
  lifetimeDays: 7,
  escapePct: 15,
  escapeMin: 5,
  escapeMax: 25,
  debtFloor: -300,
} as const

export const QUICK_PLEDGES = [20, 50, 100, 200] as const

export const PILLORY_RULES = {
  cost: 40,
  hours: 24,
  cooldownHours: 6,
  messageMax: 140,
  eggHours: 1,
  eggMaxHours: 12,
  debtFloor: -300,
} as const

// What the Crown adds the next time the wanted player wins (never more than the pledges themselves).
export function nextEscapeBonus(pledged: number, crownBonus: number): number {
  const raw = Math.max(BOUNTY_RULES.escapeMin, Math.floor((pledged * BOUNTY_RULES.escapePct) / 100))
  return Math.max(0, Math.min(raw, BOUNTY_RULES.escapeMax, pledged - crownBonus))
}

// Equal split among the hunters; the first hunters (lane order) absorb the leftover points.
export function huntShare(price: number, hunters: number): number {
  return hunters > 0 ? Math.floor(price / hunters) : 0
}

const TEAM_SIZE = 5

// The smallest share a hunter can get: the whole winning team is linked. Fewer accounts, bigger shares.
export function minHuntShare(price: number): number {
  return huntShare(price, TEAM_SIZE)
}
