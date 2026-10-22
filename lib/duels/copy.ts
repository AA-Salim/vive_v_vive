import { SIDE_NAME, otherSide } from "@/lib/duels/rules"
import type { DuelAction, DuelView } from "@/lib/duels/types"

export const DUEL_COPY = {
  title: "Trials by Combat",
  subtitle: {
    open: "Name a rival, pick a banner, stake your gold. The loser pays, the Crown takes its tithe.",
    locked: "The gates are shut. Only steel talks now.",
    result: "The Nexus has spoken. So has the treasury.",
  },
  cta: "Throw down the gauntlet",
  ctaHint: "Challenge a rival or the whole court",
  signIn: "Sign in to duel",
  signInHint: "Sign in with Discord to throw a gauntlet. The court will hold your coat.",
  empty: "No blood feuds yet. Everyone here has a grudge. Settle one.",
  emptyRetired: "Every gauntlet so far was declined or taken back. The lists are open again.",
  comingSoonTitle: "The lists are being raked",
  comingSoon:
    "Trials by combat arrive with the next royal decree: name a rival, pick a banner, put gold on it. The Crown is still sharpening the swords.",
  errorTitle: "The court scribe lost the duel ledger",
  errorHint: "Your stakes are safe. The ledger will be back shortly.",
  incomingKicker: "A gauntlet at your feet",
  mineKicker: "Your duels",
  openKicker: "Open gauntlets",
  swornKicker: "Sworn duels",
  awaitingKicker: "Awaiting an answer",
  verdictKicker: "Verdicts",
  lockedNote: "Unanswered gauntlets expire when the gates close. Every stake goes home.",
  treason: "You fight for this banner. Betting against your own team is treason, and Salaxe keeps a notebook.",
}

const VICTORY_LINES = [
  "The steel was kind. The treasury, kinder.",
  "Victory. Somewhere, Chalaksse insists he would have won too.",
  "A clean kill. The notebook gets a new page, and it is not yours.",
]

const DEFEAT_LINES = [
  "Defeat. Call it a delayed victory and hold your head high.",
  "The steel was not kind. Your rival is already typing in the chat.",
  "Lost. Salaxe wrote your name down. In pencil, for now.",
]

// Deterministic per seed: every client tells the same story about the same event.
export function pickLine<T>(lines: readonly T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return lines[h % lines.length]
}

export function verdictLine(won: boolean, seed: string): string {
  return pickLine(won ? VICTORY_LINES : DEFEAT_LINES, seed)
}

export function actionToast(duel: DuelView, action: DuelAction): { title: string; description: string } {
  if (action === "accept") {
    return {
      title: "Challenge accepted",
      description: `${duel.stake} each against ${duel.challenger.name}. May the Nexus favor ${SIDE_NAME[otherSide(duel.challengerSide)]}.`,
    }
  }
  if (action === "decline") {
    return { title: "Challenge declined", description: `${duel.challenger.name} gets the ${duel.stake} back. The court saw everything.` }
  }
  return { title: "Gauntlet withdrawn", description: `${duel.stake} back in your purse. A tactical retreat.` }
}
