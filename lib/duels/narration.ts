import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { pickLine as pick } from "@/lib/duels/copy"
import { SIDE_NAME, otherSide } from "@/lib/duels/rules"
import type { Side } from "@/lib/types"

const BIG_STAKE = 250

// Broadcast payloads come off the network: never print "undefined" in a proclamation.
const amountOf = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)
const nameOf = (value: unknown, fallback = "Someone") => (typeof value === "string" && value.trim() ? value.trim() : fallback)
const sideOf = (value: unknown): Side => (value === "red" ? "red" : "blue")

function challenged(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["duel.challenged"]
  const challenger = nameOf(d.challengerName)
  const amount = amountOf(d.amount)
  const side = SIDE_NAME[sideOf(d.side)]
  const other = SIDE_NAME[otherSide(sideOf(d.side))]
  if (typeof d.opponentName !== "string" || !d.opponentName.trim()) {
    return {
      title: `${challenger} threw down an open gauntlet`,
      description: pick(
        [
          `${amount} on ${side}. Anyone brave enough takes ${other}.`,
          `${challenger} backs ${side} for ${amount}. First to answer fights.`,
          `${amount} points on ${side}, no name on the gauntlet. The whole court is invited.`,
        ],
        event.id
      ),
      tone: amount >= BIG_STAKE ? "royal" : "hype",
    }
  }
  const opponent = nameOf(d.opponentName)
  if (amount >= BIG_STAKE) {
    return {
      title: `Blood feud: ${challenger} called out ${opponent} for ${amount}`,
      description: `${challenger} rides for ${side}. Salaxe is already writing both names in his little notebook.`,
      tone: "royal",
    }
  }
  return {
    title: `${challenger} challenged ${opponent} to a trial by combat`,
    description: pick(
      [
        `${amount} each. ${challenger} rides for ${side}, ${opponent} would take ${other}.`,
        `${amount} on ${side}. The gauntlet lies at ${opponent}'s feet.`,
        `${amount} a head. Answer before the gates close, or be remembered.`,
      ],
      event.id
    ),
    tone: "hype",
  }
}

function accepted(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["duel.accepted"]
  const amount = amountOf(d.amount)
  return {
    title: `${nameOf(d.opponentName)} answered ${nameOf(d.challengerName)}'s challenge`,
    description: pick(
      [
        `${amount} each, ${amount * 2} on the table. Steel decides.`,
        `En garde. ${amount * 2} points ride on this game.`,
        "Two purses, one Nexus. Whoever loses explains it in the voice channel.",
      ],
      event.id
    ),
    tone: amount >= BIG_STAKE ? "royal" : "hype",
  }
}

function declined(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["duel.declined"]
  const challenger = nameOf(d.challengerName)
  const opponent = nameOf(d.opponentName)
  const amount = amountOf(d.amount)
  return {
    title: `${opponent} declined ${challenger}'s challenge`,
    description: pick(
      [
        "Wisdom or cowardice? The court has opinions.",
        amount > 0
          ? `${challenger} keeps the ${amount}. ${opponent} keeps their dignity, allegedly.`
          : `${opponent} keeps their dignity, allegedly.`,
        "The gauntlet lies where it fell. Somewhere, Chalaksse takes notes.",
      ],
      event.id
    ),
    tone: "roast",
  }
}

function withdrawn(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["duel.withdrawn"]
  const challenger = nameOf(d.challengerName)
  const named = typeof d.opponentName === "string" && d.opponentName.trim() ? d.opponentName.trim() : null
  return {
    title: named ? `${challenger} withdrew the challenge to ${named}` : `${challenger} withdrew an open challenge`,
    description: pick(
      [
        `Cold feet, warm purse: ${amountOf(d.amount)} back in the pocket.`,
        "A tactical retreat. Salaxe would call it a delayed victory.",
        "The gauntlet was picked back up. Quietly. Everyone saw.",
      ],
      event.id
    ),
    tone: "roast",
  }
}

function expired(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["duel.expired"]
  const count = amountOf(d.count)
  if (count === 0) return null
  return {
    title: count === 1 ? "A challenge went unanswered" : `${count} challenges went unanswered`,
    description: `${amountOf(d.amount)} points went home. The court notes the silence.`,
    tone: "info",
  }
}

function resolved(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["duel.resolved"]
  const winner = nameOf(d.winnerName)
  const loser = nameOf(d.loserName)
  const amount = amountOf(d.amount)
  const payout = amountOf(d.payout) || amount * 2
  const tax = amountOf(d.tax)
  return {
    title: pick(
      [
        `${winner} beat ${loser} in a trial by combat`,
        `${winner} won the duel against ${loser}`,
        `Trial by combat: ${winner} over ${loser}`,
      ],
      event.id
    ),
    description:
      tax > 0
        ? `${winner} collects ${payout}, ${tax} goes to the royal tithe. ${loser} is down ${amount}.`
        : `${winner} collects ${payout}. ${loser} is down ${amount}.`,
    tone: amount >= BIG_STAKE ? "royal" : "hype",
  }
}

// Lines for every duel.* event, for lib/live/narration.ts to delegate to (as with narrateTitleEvent).
export function narrateDuelEvent(event: LiveEvent): Narration | null {
  switch (event.type) {
    case "duel.challenged":
      return challenged(event)
    case "duel.accepted":
      return accepted(event)
    case "duel.declined":
      return declined(event)
    case "duel.withdrawn":
      return withdrawn(event)
    case "duel.expired":
      return expired(event)
    case "duel.resolved":
      return resolved(event)
    default:
      return null
  }
}
