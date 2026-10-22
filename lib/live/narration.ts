import type { LiveEvent } from "@/lib/live/events"
import { narrateDecree, narratePraise, narrateShame, narrateVote } from "@/lib/lore/herald/court"
import {
  narrateBetInsured,
  narrateBetPlaced,
  narrateBetResolved,
  narratePoints,
  narrateProphecyPlaced,
  narrateProphecyResolved,
} from "@/lib/lore/herald/money"
import { narrateBounty, narrateDuel } from "@/lib/lore/herald/rivals"
import {
  narrateAct,
  narrateCoachPick,
  narrateCreated,
  narrateFearless,
  narrateQueue,
  narrateRerolled,
  narrateStatus,
  narrateVainqueur,
} from "@/lib/lore/herald/session"
import { narrateTitleEvent } from "@/lib/titles/narration"

export type NarrationTone = "info" | "hype" | "royal" | "roast" | "danger"

export interface Narration {
  title: string
  description?: string
  tone: NarrationTone
}

function wellFormedTitle(event: LiveEvent): boolean {
  const data = event.data as Record<string, unknown>
  if (event.type === "title.claimed") return Array.isArray(data.titles) && data.titles.every((t) => typeof t === "string")
  return event.type === "title.settled" || typeof data.title === "string"
}

// One line per event for toasts and the Herald feed. Variants are seeded by event.id so every client
// tells the same story. Null means the event is too granular or private to announce.
export function narrate(event: LiveEvent): Narration | null {
  switch (event.type) {
    case "session.created":
      return narrateCreated(event)
    case "session.status":
      return narrateStatus(event)
    case "session.rerolled":
      return narrateRerolled(event)
    case "session.lock":
      return null
    case "coachdraft.pick":
      return narrateCoachPick(event)
    case "bet.placed":
      return narrateBetPlaced(event)
    case "bet.insured":
      return narrateBetInsured(event)
    case "bet.resolved":
      return narrateBetResolved(event)
    case "chaos.decree":
      return narrateDecree(event)
    case "praise.sung":
    case "praise.judged":
      return narratePraise(event)
    case "sidebet.placed":
      return narrateProphecyPlaced(event)
    case "sidebet.resolved":
      return narrateProphecyResolved(event)
    case "bounty.placed":
    case "bounty.claimed":
      return narrateBounty(event)
    case "shame.posted":
      return narrateShame(event)
    case "title.equipped":
    case "title.bestowed":
    case "title.perk":
    case "title.unequipped":
    case "title.bought":
    case "title.claimed":
    case "title.dignity":
    case "title.settled":
      return wellFormedTitle(event) ? narrateTitleEvent(event) : null
    case "queue.changed":
      return narrateQueue(event)
    case "vainqueur.changed":
      return narrateVainqueur(event)
    case "fearless.changed":
      return narrateFearless(event)
    case "points.changed":
      return narratePoints(event)
    case "act.changed":
      return narrateAct(event)
    case "duel.challenged":
    case "duel.accepted":
    case "duel.declined":
    case "duel.resolved":
      return narrateDuel(event)
    case "vote.opened":
    case "vote.closed":
      return narrateVote(event)
    case "vote.cast":
      return null
    default:
      return null
  }
}
