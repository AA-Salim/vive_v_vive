import { FREE, pts, ptsRange, type HelpEntry } from "@/lib/help"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import {
  DEBT_FLOOR,
  MIN_VOTES_FOR_VERDICT,
  MVP_BONUS,
  STAKE_MAX,
  STAKE_MIN,
  VOTE_WINDOW_MS,
  type Category,
} from "@/lib/prophecy/constants"
import { formatMultiplier } from "@/lib/prophecy/odds"

const VOTE_MINUTES = Math.round(VOTE_WINDOW_MS / 60_000)
const PARI_MUTUEL = "Prophets who called the voted player split that market's whole pot by stake, so lonely calls pay the most."
const REFUNDS = "No verdict, nobody called it, or the game is canceled: every stake in that market comes back."
const SELF_INTER = "You cannot back yourself as the Inter."
const QUORUM = `The leader needs at least ${MIN_VOTES_FOR_VERDICT} votes; a two-way tie crowns both, a wider tie means no verdict.`
const FREE_PILLORY = `The voted Inter goes up on the pillory for free for ${PILLORY_RULES.hours} hours (a pillory normally costs ${pts(PILLORY_RULES.cost)}).`

export const PROPHECY_HELP: HelpEntry = {
  title: "Prophecies",
  does: "Bet on who the court will vote MVP or Inter once the Nexus falls. Each market is a shared pot settled by the Tribunal's verdict.",
  cost: `${ptsRange(STAKE_MIN, STAKE_MAX)}, one prophecy per game.`,
  reward: PARI_MUTUEL,
  limits: `Seal during the Royal Decrees or betting, before betting closes. One per game, MVP or Inter, final once sealed. ${SELF_INTER} ${REFUNDS} Purses may dip to ${DEBT_FLOOR}.`,
}

export interface SealQuote {
  name: string
  payout: number
  multiplier: number
  firstProphet: boolean
}

export function sealHelp(category: Category, stake: number, quote: SealQuote | null): HelpEntry {
  const market = category === "mvp" ? "MVP" : "Inter"
  return {
    title: `Seal an ${market} prophecy`,
    does: `Lock in who you think the court will vote ${market}. Your stake joins the ${market} pot right away.`,
    cost: `${pts(stake)} now, from ${ptsRange(STAKE_MIN, STAKE_MAX)}.`,
    reward: !quote
      ? PARI_MUTUEL
      : quote.firstProphet
        ? `You would be the first prophet in this market: every stake others seal on someone else grows your payout if the court votes ${quote.name}.`
        : `About ${pts(quote.payout)} (${formatMultiplier(quote.multiplier)}) if the court votes ${quote.name} right now. The price moves as others seal.`,
    limits: `One prophecy per game, final once sealed, before betting closes.${category === "inter" ? ` ${SELF_INTER}` : ""} ${REFUNDS}`,
  }
}

export const TRIBUNAL_HELP: HelpEntry = {
  title: "The Tribunal",
  does: "After every game the court votes an MVP and an Inter. The verdict pays the prophecies and hands out the honors.",
  cost: `${FREE} to vote.`,
  reward: `The crowned MVP earns ${pts(MVP_BONUS)} and prophets who called it split the pot. ${FREE_PILLORY}`,
  limits: `Anyone signed in may vote, for ${VOTE_MINUTES} minutes after the game is recorded. ${QUORUM} Nobody votes for themselves.`,
}

export const BALLOT_HELP: HelpEntry = {
  title: "Cast your ballot",
  does: "Tap a player to crown them MVP or name them Inter. Ballots are public and you can change them until the gavel falls.",
  cost: FREE,
  reward: `Your vote decides who earns the ${pts(MVP_BONUS)} MVP bonus, who gets the free pillory, and which prophets get paid.`,
  limits: `One MVP and one Inter ballot each, never yourself and never the same player twice. ${QUORUM}`,
}
