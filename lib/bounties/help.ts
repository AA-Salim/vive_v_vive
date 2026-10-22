import { FREE, pct, pts, ptsRange, type HelpEntry } from "@/lib/help"
import { BOUNTY_RULES, PILLORY_RULES, minHuntShare } from "@/lib/bounties/rules"
import type { PilloryEntryView, WarrantView } from "@/lib/bounties/types"

const B = BOUNTY_RULES
const P = PILLORY_RULES

const hours = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`

const SPLIT = "The linked players of the team that beats them split the whole price equally. Backers only collect if they are on that team."
const ESCAPE = `Each time the wanted player wins, the Crown adds ${pct(B.escapePct / 100)} of the pledges (${ptsRange(B.escapeMin, B.escapeMax)}), never more than was pledged.`
const EXPIRY = `Unclaimed ${B.lifetimeDays} days after the last pledge: every backer gets their points back.`
const DEBT = `Your purse can dip to ${B.debtFloor} to pay.`

export const WARRANT_HELP = {
  board: {
    title: "Royal Warrants",
    does: "Put a price on a player's head. The next team that beats them in a game splits the pot.",
    cost: `From ${pts(B.minPledge)} per pledge, paid when you sign`,
    reward: SPLIT,
    limits: `One warrant per head, anyone can stack on it, up to ${pts(B.maxBackerTotal)} per backer. ${EXPIRY}`,
  },
  pledge: {
    title: "Sign a warrant",
    does: "Prints a poster on a head, or raises the price if one is already up. Everyone who beats them gets a cut.",
    cost: `${ptsRange(B.minPledge, B.maxBackerTotal)} per head, your choice, paid now`,
    reward: SPLIT,
    limits: `Never on yourself. ${ESCAPE} ${EXPIRY} ${DEBT}`,
  },
} satisfies Record<string, HelpEntry>

export interface PledgePreview {
  targetName: string
  amount: number
  price: number
  escapeBonus: number
  refund: number
}

export function pledgeHelp({ targetName, amount, price, escapeBonus, refund }: PledgePreview): HelpEntry {
  const floor = minHuntShare(price)
  return {
    title: `Warrant on ${targetName}`,
    does: `Adds your pledge to the price on ${targetName}.`,
    cost: `${pts(amount)}, paid now`,
    reward: `${targetName} loses: the linked winners split ${pts(price)}${floor > 0 ? ` (at least ${floor} each)` : ""}. You collect only if you are on that team.`,
    limits: `${targetName} wins: an escape, ${escapeBonus > 0 ? `the Crown adds ${pts(escapeBonus)}` : "the Crown has already matched every pledge"}. Unclaimed ${B.lifetimeDays} days after the last pledge: your ${pts(refund)} come back.`,
  }
}

export function warrantHelp(warrant: WarrantView, isMe = false): HelpEntry {
  const name = warrant.target.name
  if (warrant.kind === "legacy") {
    return {
      title: `Old bounty on ${name}`,
      does: "A bounty from before the warrant reform. It keeps its old terms: the poster is paid if the target loses.",
      cost: "Closed to new pledges",
      reward: warrant.legacyPayout != null ? `${pts(warrant.legacyPayout)} to its poster if ${name} loses` : `Paid to its poster if ${name} loses`,
      limits: "Refunded to the poster if it expires unclaimed.",
    }
  }
  const floor = minHuntShare(warrant.price)
  const escape =
    warrant.nextEscapeBonus > 0 ? `If ${isMe ? "you win" : `${name} wins`}, the Crown adds ${pts(warrant.nextEscapeBonus)}.` : "The Crown has already matched every pledge."
  if (isMe) {
    return {
      title: "The price on your head",
      does: `The court wants you beaten. Lose a game and the team that beat you splits ${pts(warrant.price)}.`,
      cost: "Nothing from your purse. Losing just pays your enemies.",
      limits: `${escape} ${EXPIRY}`,
    }
  }
  return {
    title: `Warrant on ${name}`,
    does: `Beat ${name} in a game and your team splits the ${pts(warrant.price)}.`,
    cost: `Free to hunt. Raising the price: from ${pts(B.minPledge)}`,
    reward: `${pts(warrant.price)} split by the linked winners${floor > 0 ? `, at least ${floor} each` : ""}.`,
    limits: `${escape} ${EXPIRY}`,
  }
}

export const PILLORY_HELP = {
  wall: {
    title: "The Pillory",
    does: "Nail a player to the wall with their worst real stat and a roast. The rest of the court pelts them with eggs.",
    cost: `${pts(P.cost)} per pillory. Eggs are free`,
    reward: "Nobody gets paid. The shame is the point.",
    limits: `${hours(P.hours)} on the wall. One live entry per player, one pillory per shamer every ${hours(P.cooldownHours)}. The Tribunal's Inter goes up for free.`,
  },
  post: {
    title: "Pillory someone",
    does: `Puts a player on the wall for ${hours(P.hours)} with their worst real stat and your roast.`,
    cost: `${pts(P.cost)}, paid now`,
    reward: "No payout, only glory and eggs.",
    limits: `Not yourself, and not someone already on the wall. One pillory every ${hours(P.cooldownHours)}, roast up to ${P.messageMax} characters. Your purse can dip to ${P.debtFloor}.`,
  },
  egg: {
    title: "Throw an egg",
    does: `Pelt someone on the wall. Each egg keeps them up ${hours(P.eggHours)} longer.`,
    cost: FREE,
    limits: `One egg per person per entry, never at yourself. Eggs add ${hours(P.eggMaxHours)} at most.`,
  },
} satisfies Record<string, HelpEntry>

export function tribunalHelp(entry: PilloryEntryView): HelpEntry {
  const verdict = entry.tribunal
  const tally = verdict && verdict.ballots > 0 ? ` ${verdict.votes} of ${verdict.ballots} ballots said Inter.` : ""
  return {
    title: "Tribunal pillory",
    does: `The post-game Tribunal voted ${entry.target.name} the Inter, so the Crown nailed them up itself.${tally}`,
    cost: "Free. The Crown pays the carpenters",
    limits: `${hours(P.hours)} from the verdict, once per vote. Eggs work as usual, and anyone can still pillory them for their stats.`,
  }
}
