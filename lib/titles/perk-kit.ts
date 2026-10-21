import type { Role, Side } from "@/lib/types"
import { MIN_STAKE } from "@/lib/titles/rules"
import type { PerkKind, PerkTrigger } from "@/lib/titles/types"

export interface PerkSubject {
  userId: string
  isSalaxe: boolean
  play: { side: Side; lane: Role; won: boolean } | null
  bet: { side: Side; stake: number; payout: number; won: boolean } | null
  chaosSpent: number
  bountyClaimed: number
}

export interface PerkGame {
  sessionId: string
  winnerSide: Side
  salaxeSide: Side | null
  pool: number
  backers: Record<Side, number>
}

export interface PerkHit {
  amount: number
  detail: string
}

export interface PerkDefinition {
  kind: PerkKind
  trigger: PerkTrigger
  cap: number
  // `to` names whoever collects a curse's tribute; perks ignore it.
  describe: (to: string) => string
  evaluate: (subject: PerkSubject, game: PerkGame, roll: number) => PerkHit | null
}

export const hit = (amount: number, detail: string): PerkHit | null => (amount === 0 ? null : { amount, detail })
export const share = (value: number, percent: number) => Math.round((value * percent) / 100)
export const profit = (s: PerkSubject) => (s.bet?.won ? Math.max(0, s.bet.payout - s.bet.stake) : 0)
export const loss = (s: PerkSubject) => (s.bet && !s.bet.won ? Math.max(0, s.bet.stake - s.bet.payout) : 0)
export const staked = (s: PerkSubject) => !!s.bet && s.bet.stake >= MIN_STAKE

// The King can neither kneel to himself nor slay himself.
export const crownPlays = (s: PerkSubject, g: PerkGame) => g.salaxeSide !== null && !s.isSalaxe
export const crownWon = (g: PerkGame) => g.salaxeSide === g.winnerSide

export function isInvolved(s: PerkSubject): boolean {
  return s.play !== null || staked(s) || s.chaosSpent > 0 || s.bountyClaimed > 0
}

export const fixed = (text: string) => () => text

export function onWin(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "win",
    cap: amount,
    describe: fixed(`+${amount} every game you win`),
    evaluate: (s) => (s.play?.won ? hit(amount, detail) : null),
  }
}

export function onLoss(amount: number, detail: string, summary = `+${amount} every game you lose`): PerkDefinition {
  return {
    kind: "perk",
    trigger: "loss",
    cap: amount,
    describe: fixed(summary),
    evaluate: (s) => (s.play && !s.play.won ? hit(amount, detail) : null),
  }
}

export function onPlay(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "play",
    cap: amount,
    describe: fixed(`+${amount} every game you play`),
    evaluate: (s) => (s.play ? hit(amount, detail) : null),
  }
}

export function betProfitShare(percent: number, cap: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "bet_win",
    cap,
    describe: fixed(`Win a bet: +${percent}% of the profit (max ${cap})`),
    evaluate: (s) => hit(share(profit(s), percent), detail),
  }
}

export function betLossRefund(percent: number, cap: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "bet_loss",
    cap,
    describe: fixed(`Lose a bet: ${percent}% back (max ${cap})`),
    evaluate: (s) => hit(share(loss(s), percent), detail),
  }
}

export function betDividend(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "bet_any",
    cap: amount,
    describe: fixed(`+${amount} every game you bet ${MIN_STAKE}+ on`),
    evaluate: (s) => (staked(s) ? hit(amount, detail) : null),
  }
}

export function crownWins(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "crown_wins",
    cap: amount,
    describe: fixed(`+${amount} whenever Salaxe's side wins`),
    evaluate: (s, g) => (crownPlays(s, g) && crownWon(g) ? hit(amount, detail) : null),
  }
}

export function crownFalls(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "crown_falls",
    cap: amount,
    describe: fixed(`+${amount} whenever Salaxe's side loses`),
    evaluate: (s, g) => (crownPlays(s, g) && !crownWon(g) ? hit(amount, detail) : null),
  }
}

export function coinFlip(amount: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "chance",
    cap: amount,
    describe: fixed(`Every game: 50% chance of +${amount}`),
    evaluate: (_s, _g, roll) => (roll < 0.5 ? hit(amount, detail) : null),
  }
}

export function chaosRefund(percent: number, cap: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "chaos",
    cap,
    describe: fixed(`${percent}% of your Royal Decree spend back (max ${cap})`),
    evaluate: (s) => hit(share(s.chaosSpent, percent), detail),
  }
}

export function bountyBonus(percent: number, cap: number, detail: string): PerkDefinition {
  return {
    kind: "perk",
    trigger: "bounty",
    cap,
    describe: fixed(`Cash a bounty: +${percent}% on top (max ${cap})`),
    evaluate: (s) => hit(share(s.bountyClaimed, percent), detail),
  }
}

export function tribute(amount: number, detail: string): PerkDefinition {
  return {
    kind: "curse",
    trigger: "play",
    cap: amount,
    describe: (to) => `Every game: ${amount} points to ${to}`,
    evaluate: () => hit(-amount, detail),
  }
}
