import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import { narrate, type Narration } from "@/lib/live/narration"

const fmt = new Intl.NumberFormat("en-US")

const text = (value: unknown, fallback: string) => (typeof value === "string" && value ? value : fallback)
const points = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? fmt.format(value) : "some")

// Only used when the narration has no line for an event the live policy promises to announce:
// duel alerts aimed at the viewer, the tribunal and a new act must never vanish silently.
function fallbackLine(event: LiveEvent): Narration | null {
  switch (event.type) {
    case "duel.challenged": {
      const d = event.data as LiveEventPayloads["duel.challenged"]
      const challenger = text(d.challengerName, "Someone")
      return {
        title: d.opponentName ? `${challenger} challenged ${d.opponentName} to a duel` : `${challenger} threw down an open duel`,
        description: `${points(d.amount)} points · ${challenger} backs ${d.side === "red" ? "Red" : "Blue"}`,
        tone: "hype",
      }
    }
    case "duel.accepted": {
      const d = event.data as LiveEventPayloads["duel.accepted"]
      const duel = d.challengerName ? `${d.challengerName}'s duel` : "a duel"
      return {
        title: `${text(d.opponentName, "Someone")} accepted ${duel}`,
        description: `${points(d.amount)} points on the line`,
        tone: "hype",
      }
    }
    case "duel.declined": {
      const d = event.data as LiveEventPayloads["duel.declined"]
      const duel = d.challengerName ? `${d.challengerName}'s duel` : "a duel"
      return {
        title: `${text(d.opponentName, "Someone")} declined ${duel}`,
        description: "The gauntlet stays on the floor.",
        tone: "roast",
      }
    }
    case "duel.resolved": {
      const d = event.data as LiveEventPayloads["duel.resolved"]
      return {
        title: `${text(d.winnerName, "Someone")} won the duel against ${text(d.loserName, "someone")}`,
        description: `${points(d.amount)} points change hands`,
        tone: "hype",
      }
    }
    case "vote.opened":
      return { title: "The tribunal is open", description: "Name the MVP and the inter before it closes.", tone: "royal" }
    case "vote.closed": {
      const d = event.data as LiveEventPayloads["vote.closed"]
      const verdict = [d.mvpName ? `MVP: ${d.mvpName}` : null, d.interName ? `Inter: ${d.interName}` : null]
      return {
        title: "The tribunal has spoken",
        description: verdict.filter(Boolean).join(" · ") || "No verdict this time.",
        tone: "royal",
      }
    }
    case "act.changed": {
      const d = event.data as LiveEventPayloads["act.changed"]
      const act = typeof d.actNumber === "number" ? `Act ${d.actNumber}` : "A new act"
      return { title: d.status === "active" ? `${act} begins` : `${act} closes its curtain`, tone: "royal" }
    }
    default:
      return null
  }
}

// Events come off the network: a malformed payload must never break the feed or the toasts.
export function safeNarrate(event: LiveEvent): Narration | null {
  try {
    const line = narrate(event) ?? fallbackLine(event)
    return line && typeof line.title === "string" && line.title ? line : null
  } catch {
    return null
  }
}

function whoList(events: LiveEvent[]): string {
  const names = [...new Set(events.map((e) => e.actor?.name).filter((n): n is string => !!n))]
  if (names.length === 0) return ""
  if (names.length <= 2) return names.join(" and ")
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + (Number.isFinite(pick(item)) ? pick(item) : 0), 0)
}

function bets(events: LiveEvent[]): Narration {
  const placed = events.filter((e) => e.type === "bet.placed")
  const insured = events.filter((e) => e.type === "bet.insured" || (e.data as LiveEventPayloads["bet.placed"]).insured)
  const bySide = (side: "blue" | "red") =>
    sumBy(
      placed.filter((e) => (e.data as LiveEventPayloads["bet.placed"]).side === side),
      (e) => (e.data as LiveEventPayloads["bet.placed"]).amount
    )
  const blue = bySide("blue")
  const red = bySide("red")
  const sides = [blue > 0 ? `+${fmt.format(blue)} on Blue` : null, red > 0 ? `+${fmt.format(red)} on Red` : null]
    .filter(Boolean)
    .join(", ")
  const title = placed.length > 0 ? `${plural(placed.length, "new bet", "new bets")}${sides ? `: ${sides}` : ""}` : `${plural(insured.length, "bet", "bets")} insured`
  const extra = placed.length > 0 && insured.length > 0 ? `${insured.length} insured` : null
  return {
    title,
    description: [whoList(events), extra].filter(Boolean).join(" · ") || undefined,
    tone: blue + red >= 300 ? "hype" : "info",
  }
}

function decrees(events: LiveEvent[]): Narration {
  const labels = [...new Set(events.map((e) => (e.data as LiveEventPayloads["chaos.decree"]).label).filter(Boolean))]
  const spent = sumBy(events, (e) => (e.data as LiveEventPayloads["chaos.decree"]).cost)
  return {
    title: `${plural(events.length, "royal decree", "royal decrees")} signed`,
    description: [labels.slice(0, 3).join(", "), spent > 0 ? `${fmt.format(spent)} points spent` : null]
      .filter(Boolean)
      .join(" · "),
    tone: "royal",
  }
}

function sidebets(events: LiveEvent[]): Narration {
  const riding = sumBy(events, (e) => (e.data as LiveEventPayloads["sidebet.placed"]).amount)
  return {
    title: `${plural(events.length, "prophecy", "prophecies")} sealed`,
    description: [whoList(events), riding > 0 ? `${fmt.format(riding)} points riding` : null].filter(Boolean).join(" · "),
    tone: "info",
  }
}

function perks(events: LiveEvent[]): Narration {
  const titles = [...new Set(events.map((e) => (e.data as LiveEventPayloads["title.perk"]).title).filter(Boolean))]
  return {
    title: `${plural(events.length, "title perk", "title perks")} triggered`,
    description: titles.slice(0, 3).join(", ") || undefined,
    tone: "royal",
  }
}

function duels(events: LiveEvent[]): Narration {
  const lines = events
    .slice(0, 2)
    .map((e) => {
      const d = e.data as LiveEventPayloads["duel.resolved"]
      return `${d.winnerName} beat ${d.loserName}`
    })
  return {
    title: `${plural(events.length, "duel", "duels")} settled`,
    description: lines.join(" · ") + (events.length > 2 ? ` · +${events.length - 2} more` : ""),
    tone: "hype",
  }
}

function queue(events: LiveEvent[]): Narration {
  const names = (action: "joined" | "left") =>
    events
      .filter((e) => (e.data as LiveEventPayloads["queue.changed"]).action === action)
      .map((e) => (e.data as LiveEventPayloads["queue.changed"]).playerName)
      .filter((n): n is string => !!n)
  const joined = [...new Set(names("joined"))]
  const left = [...new Set(names("left"))]
  const parts = [
    joined.length ? `${joined.slice(0, 3).join(", ")}${joined.length > 3 ? ` +${joined.length - 3}` : ""} joined` : null,
    left.length ? `${left.slice(0, 3).join(", ")}${left.length > 3 ? ` +${left.length - 3}` : ""} left` : null,
  ].filter(Boolean)
  return { title: "The queue is moving", description: parts.join(" · ") || undefined, tone: "info" }
}

// One narration for a burst of related events (see coalesceKey in policy.ts).
export function summarize(key: string, events: LiveEvent[], fallback: Narration): Narration {
  if (events.length <= 1) return fallback
  try {
    return summarizeBurst(key, events, fallback)
  } catch {
    return { ...fallback, title: `${fallback.title} (+${events.length - 1})` }
  }
}

function summarizeBurst(key: string, events: LiveEvent[], fallback: Narration): Narration {
  const kind = key.split(":")[0]
  switch (kind) {
    case "bets":
      return bets(events)
    case "decrees":
      return decrees(events)
    case "sidebets":
      return sidebets(events)
    case "perks":
      return perks(events)
    case "duels":
      return duels(events)
    case "queue":
      return queue(events)
    case "votes":
      return { title: `${plural(events.length, "vote", "votes")} cast`, description: "The tribunal is filling up.", tone: "info" }
    default:
      return { ...fallback, title: `${fallback.title} (+${events.length - 1})` }
  }
}
