import { BET_RULES } from "@/lib/betting/rules"
import { FREE, type HelpEntry } from "@/lib/help"
import { LOBBY_SIZE, SERPENTINE } from "@/lib/lobby/constants"
import {
  BETTING_DURATION_MS,
  CHAOS_DURATION_MS,
  GAME_PARTICIPATION_POINTS,
  GAME_WIN_POINTS,
} from "@/lib/session/constants"
import type { SessionStatus } from "@/lib/types"
import type { RoomPhase } from "@/components/session/copy"

export function durationLabel(ms: number): string {
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000
    return `${minutes} minute${minutes === 1 ? "" : "s"}`
  }
  return `${Math.round(ms / 1000)} seconds`
}

const DECREES_FOR = durationLabel(CHAOS_DURATION_MS)
const BETS_FOR = durationLabel(BETTING_DURATION_MS)
const SIDE = { blue: "Blue", red: "Red" } as const

export const GAME_POINTS_LINE = `+${GAME_WIN_POINTS} to each winner, +${GAME_PARTICIPATION_POINTS} to each loser`
const SETTLED_LINE = "Bets, King's Wagers, duels, prophecies and bounties pay their winners"
const HOST_ONLY = "Host or admin only."

export const PHASE_HELP: Record<RoomPhase, HelpEntry> = {
  lobby: {
    title: "The lobby",
    does: `Pick ${LOBBY_SIZE} players from the roster and roll. Everyone watches the draw live.`,
    cost: FREE,
  },
  coach_draft: {
    title: "Coach Draft",
    does: "Two coaches pick their five in snake order, then set their lanes. Champions are dealt at random once both teams are locked.",
    cost: FREE,
    limits: `Order: ${SERPENTINE.map((s) => SIDE[s]).join(", ")}. Only the coach on the clock picks. The host or an admin can scrap the draft.`,
  },
  draft: {
    title: "The Draft",
    does: "Fate deals a champion to every seat. The host locks the picks worth keeping and re-rolls the rest.",
    cost: FREE,
    limits: "Re-rolls are free and unlimited until the host starts the game. Champions already played today (fearless bans) never come up.",
  },
  chaos: {
    title: "Royal Decrees",
    does: `${DECREES_FOR} to spend points on decrees that bend the draft: rerolls, lane swaps, pardons, or a King's Wager on a side.`,
    cost: "Each decree shows its price on its card",
    reward: "Only the King's Wager pays back. A canceled game refunds every decree.",
    limits: `Closes when the timer runs out or the host closes it early. Betting opens right after.`,
  },
  betting: {
    title: "Betting Window",
    does: "Back Blue or Red with your points. The winning side splits the whole pool in proportion to their stakes.",
    cost: `Your stake. Guardian Angel insurance adds ${BET_RULES.premiumPct}% to ${BET_RULES.premiumMaxPct}% of it.`,
    reward: `Your share of the pool, +${BET_RULES.earlyBonusPct}% of the profit for bets in the first ${BET_RULES.earlySeconds}s, +${BET_RULES.allInBonusPct}% for an all-in.`,
    limits: `Open for ${BETS_FOR} after decrees close, or until the host locks bets. MVP and Inter prophecies are open too.`,
  },
  in_game: {
    title: "On the Rift",
    does: "Bets and decrees are locked and the game is being played. The host declares the winner when the Nexus falls.",
    cost: FREE,
    reward: `${GAME_POINTS_LINE}. ${SETTLED_LINE}.`,
    limits: "Only the host or an admin can declare the winner or cancel.",
  },
  result: {
    title: "The result",
    does: "The game is recorded and every wager on it has been settled.",
    cost: FREE,
    reward: `${GAME_POINTS_LINE}. ${SETTLED_LINE}.`,
    limits: `All ${LOBBY_SIZE} champions join today's fearless bans.`,
  },
}

export const BET_WINDOW_HELP: HelpEntry = {
  title: "The betting window",
  does: `Bets and insurance can be placed for ${BETS_FOR} after the decree window closes.`,
  cost: FREE,
  limits: "The host or an admin can lock bets early. When it closes, the game goes live and the pool is frozen.",
}

export const START_HELP: HelpEntry = {
  title: "Start game",
  does: `Seals the draft and opens the decree window for ${DECREES_FOR}. Betting follows for ${BETS_FOR}.`,
  cost: FREE,
  limits: `${HOST_ONLY} Re-rolls and locks end here.`,
}

export function rerollHelp(unlocked: number, total: number): HelpEntry {
  return {
    title: "Re-roll",
    does: "Deals a new champion to every unlocked seat. Locked seats keep their pick.",
    cost: FREE,
    limits: `${HOST_ONLY} Unlimited during the draft. ${unlocked} of ${total} seats unlocked. Today's fearless bans are skipped.`,
  }
}

export const LOCK_HELP: HelpEntry = {
  title: "Lock a seat",
  does: "A locked champion survives every re-roll. Unlock it to throw it back in the pot.",
  cost: FREE,
  limits: `${HOST_ONLY} Draft only. Locks do not stop decrees: a locked champion can still be exiled or swapped.`,
}

export const CLOSE_DECREES_HELP: HelpEntry = {
  title: "Close decrees now",
  does: `Nobody can cast a decree after this. Betting opens right away for ${BETS_FOR}.`,
  cost: FREE,
  limits: `${HOST_ONLY} Decrees already sealed stand.`,
}

export const LOCK_BETS_HELP: HelpEntry = {
  title: "Lock bets now",
  does: "Nobody can bet or buy insurance after this, even with time left on the clock. The game goes live.",
  cost: FREE,
  limits: `${HOST_ONLY} Bets already placed stay in the pool.`,
}

export const DECLARE_HELP: HelpEntry = {
  title: "Declare winner",
  does: "Records the game for the side that took the Nexus and settles every wager on it.",
  cost: FREE,
  reward: `${GAME_POINTS_LINE} (linked accounts). ${SETTLED_LINE}.`,
  limits: `${HOST_ONLY} Cannot be undone. All ${LOBBY_SIZE} champions join today's fearless bans.`,
}

const REFUND_LINE = "Every bet (insurance premiums included), decree, duel stake and prophecy stake goes back to its owner."

export function cancelHelp(status: SessionStatus): HelpEntry {
  return {
    title: status === "coach_draft" ? "Cancel draft" : "Cancel game",
    does: "Scraps the game before the Nexus falls. Nothing is recorded: no win, no loss, no game points.",
    cost: FREE,
    reward: REFUND_LINE,
    limits: `${HOST_ONLY} Only before a winner is declared.`,
  }
}

export const CANCELED_HELP: HelpEntry = {
  title: "Canceled game",
  does: "This game was scrapped before a winner was declared, so nothing was recorded.",
  cost: FREE,
  reward: REFUND_LINE,
}

export const RESULT_POINTS_HELP: HelpEntry = {
  title: "Points for this game",
  does: "Declaring the winner paid the game points and settled every wager placed on this game.",
  cost: FREE,
  reward: `${GAME_POINTS_LINE}. ${SETTLED_LINE}.`,
  limits: "Only players with a linked Discord account collect game points. Paid once per game.",
}

export function fearlessHelp(): HelpEntry {
  const now = new Date()
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const local = reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return {
    title: "Fearless bans",
    does: "Every champion played in a finished game is banned from the rolls for the rest of the day, so nobody sees the same pick twice.",
    cost: FREE,
    limits: `The list resets at midnight UTC (${local} your time). If a lane runs out of champions, the rule bends for that seat.`,
  }
}

export const UNBAN_HELP: HelpEntry = {
  title: "Edit fearless bans",
  does: "Puts a banned champion back in the pool for the next rolls.",
  cost: FREE,
  limits: "Any signed-in member can return a champion. Only admins can wipe the whole list.",
}

export const WIPE_FEARLESS_HELP: HelpEntry = {
  title: "Wipe the list",
  does: "Clears every fearless ban for today.",
  cost: FREE,
  limits: "Admins only. Games declared after the wipe add their champions as usual.",
}
