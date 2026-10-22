import { FREE, pts, ptsRange, type HelpEntry } from "@/lib/help"
import { DUEL_RULES, SIDE_NAME, duelPayout, duelTax, otherSide } from "@/lib/duels/rules"
import type { Side } from "@/lib/types"

const TITHE = `the royal tithe (${DUEL_RULES.taxPct}% of the winnings, burned)`
const REFUNDS = "Declined, withdrawn, unanswered when betting closes, or game canceled: every stake goes home."
const OWN_TEAM = "Players only fight for their own team: nobody can take the side against their own banner."

function payoutLine(stake: number): string {
  return `${pts(duelPayout(stake))} if your side wins (${pts(stake * 2)} in the pot, minus ${pts(duelTax(stake))} for the royal tithe).`
}

export const DUEL_PANEL_HELP: HelpEntry = {
  title: "Trials by Combat",
  does: "A 1v1 bet with another subject on who wins this game. Name a rival or throw an open gauntlet anyone can answer; both sides put up the same stake.",
  cost: `Your stake, ${ptsRange(DUEL_RULES.minStake, DUEL_RULES.maxStake)}, held from the moment you throw or accept.`,
  reward: `The winner takes the pot minus ${TITHE}. A ${pts(DUEL_RULES.maxStake)} duel pays ${pts(duelPayout(DUEL_RULES.maxStake))}.`,
  limits: `${OWN_TEAM} One duel per pair per game, ${DUEL_RULES.maxPending} unanswered and ${DUEL_RULES.maxThrown} thrown gauntlets per game at most. Purses may dip to ${DUEL_RULES.debtFloor}. ${REFUNDS}`,
}

// Pass the stake being typed to quote it exactly, or null for the generic rule.
export function challengeHelp(stake: number | null): HelpEntry {
  return {
    title: "Throw the gauntlet",
    does: "Pick your banner, a rival (or the whole court) and a price. Your stake leaves your purse now; whoever answers puts up the same on the other side.",
    cost:
      stake === null
        ? `Your stake, ${ptsRange(DUEL_RULES.minStake, DUEL_RULES.maxStake)}, held until the duel ends or is refunded.`
        : `${pts(stake)}, held until the duel ends or is refunded.`,
    reward: stake === null ? `The pot minus ${TITHE}.` : payoutLine(stake),
    limits: `Answers are accepted until betting closes. One open gauntlet at a time, ${DUEL_RULES.maxPending} unanswered and ${DUEL_RULES.maxThrown} thrown per game. ${OWN_TEAM} ${REFUNDS}`,
  }
}

export const CHALLENGE_HELP = challengeHelp(null)

export function acceptHelp(stake: number, challengerSide: Side): HelpEntry {
  return {
    title: "Accept the duel",
    does: `You take ${SIDE_NAME[otherSide(challengerSide)]} against the challenger's ${SIDE_NAME[challengerSide]} for the same stake. Once sworn, the duel cannot be undone.`,
    cost: `${pts(stake)}, held until the Nexus falls.`,
    reward: payoutLine(stake),
    limits: `Until betting closes. ${OWN_TEAM} One duel per pair per game. Your purse may dip to ${DUEL_RULES.debtFloor}. A canceled game refunds both sides.`,
  }
}

export function respondHelp(stake: number, challengerSide: Side): HelpEntry {
  return {
    ...acceptHelp(stake, challengerSide),
    title: "Accept or decline",
    does: `Accept to take ${SIDE_NAME[otherSide(challengerSide)]} for the same stake. Decline to send the gauntlet back: it costs you nothing and the challenger gets every point back.`,
    cost: `Accept: ${pts(stake)}, held until the Nexus falls. Decline: ${FREE}.`,
  }
}

export function withdrawHelp(stake: number): HelpEntry {
  return {
    title: "Withdraw the gauntlet",
    does: "Take back a challenge nobody has answered yet. A tactical retreat, the court will only snigger a little.",
    cost: FREE,
    reward: `Your ${pts(stake)} come straight back.`,
    limits: `Only while nobody has answered; unanswered gauntlets refund themselves when betting closes anyway. Withdrawn ones still count toward the ${DUEL_RULES.maxThrown} you can throw per game.`,
  }
}
