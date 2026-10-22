import { BET_RULES } from "@/lib/betting/rules"

export const MARKET_COPY = {
  title: "Royal Wagers",
  subtitle: "Every bet goes in Salaxe's little notebook. Especially the bad ones.",
  emptyOpen: `The notebook is blank. Bet in the first ${BET_RULES.earlySeconds}s and early conviction pays +${BET_RULES.earlyBonusPct}% on profit.`,
  emptyClosed: "Nobody dared to bet on this one. The Charamil has gone soft.",
  locked: "Bets are locked. Now pray for a jungle diff.",
  closing: "The notebook is closing. No more ink for latecomers.",
  lastCall: "Last call",
  loginCta: "Log in with Discord to bet",
  loginHint: "The bookmaker only takes wagers from known faces.",
  earlyTitle: `Early conviction +${BET_RULES.earlyBonusPct}%`,
  earlyHint: "Bet now and the house adds a tenth of your profit if you are right.",
  insuranceTitle: "Guardian Angel",
  allInTitle: "All-in",
  allInHint: `Stake your whole purse (${BET_RULES.allInMin}+). Win: +${BET_RULES.allInBonusPct}% on profit. Lose: the court hears about it.`,
  ownSideTitle: "Loyal to your banner",
  ownSideDoes:
    "You play in this game, so the notebook only takes your bet on your own team. Spectators may back either side. A bet against yourself, all-in bonus included, would pay you to throw.",
} as const

const ALL_IN_ROASTS = [
  (n: string) => `${n} went all-in and lost it all. Salaxe underlined the name twice.`,
  (n: string) => `${n} shoved the whole stack. The stack is gone. The notebook remembers.`,
  (n: string) => `All-in, all gone. ${n} has unlocked full 0/8 Yone energy.`,
  (n: string) => `${n} called Baron with the entire bank account. Died in 0.3 seconds.`,
  (n: string) => `${n} bet the house. The house is now Salaxe's summer residence in exile.`,
  (n: string) => `${n} went all-in on a "delayed victory". It was a loss.`,
]

const ALL_IN_SELF_ROASTS = [
  "You went all-in and lost it all. Salaxe underlined your name twice.",
  "You shoved the whole stack. The stack is gone. The notebook remembers.",
  "All-in, all gone. Full 0/8 Yone energy.",
  "You called Baron with the entire bank account. Died in 0.3 seconds.",
  "You bet the house. The house is now Salaxe's summer residence in exile.",
]

const WIN_LINES = [
  "The notebook records a rare moment of competence.",
  "Read the game like a jungler reads an unwarded river.",
  "Salaxe would like a cut. Salaxe will not get a cut.",
  "Clean. No flash wasted, no gold left on the table.",
  "Even the exiled king raised an eyebrow.",
]

const LOSS_LINES = [
  "Gone, like Salaxe's crown. Ff15 next time.",
  "Your points walked into the Baron pit alone.",
  "The notebook has a new entry. It is your name.",
  "That bet was a delayed victory. So, a loss.",
  "Inted harder than a 0/8 Yone. Respectfully.",
]

const INSURED_LOSS_LINES = [
  "The Guardian Angel popped. You live, poorer but wiser.",
  "Stasis saved you. Your wallet still took the hit.",
  "Coward's insurance paid out. The court saw everything.",
]

const REFUND_LINES = [
  "Nobody took the other side. Stakes and premiums returned.",
  "A one-sided pool pays nobody. The notebook hands everything back.",
]

const CANCELED_LINES = [
  "The game was called off. The notebook tears out the page.",
  "No game, no wager. Stakes and premiums returned, pride intact.",
]

function seededIndex(seed: string, length: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(hash) % length
}

export function allInRoast(name: string, seed: string): string {
  return ALL_IN_ROASTS[seededIndex(`${seed}:${name}`, ALL_IN_ROASTS.length)](name)
}

export function allInSelfRoast(seed: string): string {
  return ALL_IN_SELF_ROASTS[seededIndex(seed, ALL_IN_SELF_ROASTS.length)]
}

const RESULT_LINES = {
  win: WIN_LINES,
  loss: LOSS_LINES,
  insured: INSURED_LOSS_LINES,
  refund: REFUND_LINES,
  canceled: CANCELED_LINES,
} as const

export function resultLine(kind: keyof typeof RESULT_LINES, seed: string): string {
  const pool = RESULT_LINES[kind]
  return pool[seededIndex(seed, pool.length)]
}
