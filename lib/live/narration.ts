import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"

export type NarrationTone = "info" | "hype" | "royal" | "roast" | "danger"

export interface Narration {
  title: string
  description?: string
  tone: NarrationTone
}

const STATUS_LINES: Record<string, Narration> = {
  coach_draft: { title: "The coaches take their seats", tone: "info" },
  draft: { title: "The teams have been drawn", tone: "info" },
  chaos: { title: "Royal Decrees are open", description: "Spend points to bend the draft.", tone: "royal" },
  betting: { title: "Betting is open", description: "Place your bets before the timer runs out.", tone: "hype" },
  in_game: { title: "Bets are locked", description: "The game is live. Pray.", tone: "hype" },
  blue_win: { title: "Blue side wins", tone: "hype" },
  red_win: { title: "Red side wins", tone: "hype" },
  canceled: { title: "Game canceled", description: "All wagers refunded.", tone: "info" },
  expired: { title: "Session expired", tone: "info" },
}

export function narrate(event: LiveEvent): Narration | null {
  const who = event.actor?.name ?? "Someone"
  switch (event.type) {
    case "session.created":
      return { title: `${who} started a new game`, tone: "info" }
    case "session.status": {
      const d = event.data as LiveEventPayloads["session.status"]
      return STATUS_LINES[d.to] ?? null
    }
    case "session.rerolled":
      return { title: `${who} re-rolled the draft`, tone: "info" }
    case "session.lock":
      return null
    case "coachdraft.pick": {
      const d = event.data as LiveEventPayloads["coachdraft.pick"]
      return { title: `${d.coachName} drafted ${d.playerName}`, tone: "info" }
    }
    case "bet.placed": {
      const d = event.data as LiveEventPayloads["bet.placed"]
      return { title: `${who} bet ${d.amount} on ${d.side === "blue" ? "Blue" : "Red"}`, tone: d.amount >= 150 ? "hype" : "info" }
    }
    case "bet.insured": {
      const d = event.data as LiveEventPayloads["bet.insured"]
      return { title: `${who} insured their ${d.amount} point bet`, tone: "info" }
    }
    case "bet.resolved": {
      const d = event.data as LiveEventPayloads["bet.resolved"]
      return d.topWinner
        ? { title: `${d.topWinner.name} cashed out ${d.topWinner.payout} points`, tone: "hype" }
        : null
    }
    case "chaos.decree": {
      const d = event.data as LiveEventPayloads["chaos.decree"]
      return { title: `${who} decreed: ${d.label}`, description: d.targetName ? `Target: ${d.targetName}` : undefined, tone: "royal" }
    }
    case "praise.sung": {
      const d = event.data as LiveEventPayloads["praise.sung"]
      return { title: `${who} sang for Salaxe`, description: `"${d.excerpt}"`, tone: "royal" }
    }
    case "praise.judged": {
      const d = event.data as LiveEventPayloads["praise.judged"]
      return { title: `Salaxe judged ${d.authorName}'s praise: ${d.verdict}`, tone: "royal" }
    }
    case "sidebet.placed": {
      const d = event.data as LiveEventPayloads["sidebet.placed"]
      return { title: `${who} backed "${d.label}"`, description: `${d.amount} points`, tone: "info" }
    }
    case "sidebet.resolved": {
      const d = event.data as LiveEventPayloads["sidebet.resolved"]
      return { title: `"${d.label}" settled`, description: `${d.winners} winner(s)`, tone: "hype" }
    }
    case "bounty.placed": {
      const d = event.data as LiveEventPayloads["bounty.placed"]
      return { title: `${who} put a ${d.amount} point bounty on ${d.targetName}`, tone: "danger" }
    }
    case "bounty.claimed": {
      const d = event.data as LiveEventPayloads["bounty.claimed"]
      return { title: `The bounty on ${d.targetName} was claimed`, tone: "danger" }
    }
    case "shame.posted": {
      const d = event.data as LiveEventPayloads["shame.posted"]
      return { title: `${who} nailed ${d.targetName} to the Shame Board`, tone: "roast" }
    }
    case "title.equipped": {
      const d = event.data as LiveEventPayloads["title.equipped"]
      return { title: `${who} is now known as ${d.title}`, tone: "royal" }
    }
    case "title.bestowed": {
      const d = event.data as LiveEventPayloads["title.bestowed"]
      return { title: `${who} branded ${d.targetName} "${d.title}"`, tone: "roast" }
    }
    case "title.perk": {
      const d = event.data as LiveEventPayloads["title.perk"]
      return { title: `${who}'s title "${d.title}" triggered`, description: d.perk, tone: "royal" }
    }
    case "queue.changed": {
      const d = event.data as LiveEventPayloads["queue.changed"]
      if (d.action === "joined" && d.playerName) return { title: `${d.playerName} joined the queue`, tone: "info" }
      if (d.action === "left" && d.playerName) return { title: `${d.playerName} left the queue`, tone: "info" }
      return null
    }
    default:
      return null
  }
}
