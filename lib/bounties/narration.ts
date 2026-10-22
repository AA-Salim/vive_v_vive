import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"

function joinNames(names: string[] | undefined): string {
  const list = (names ?? []).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ""
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Lines for the bounty.* and shame.* events; lib/live/narration.ts can delegate to this.
export function narrateBountyEvent(event: LiveEvent): Narration | null {
  const who = event.actor?.name ?? "Someone"
  switch (event.type) {
    case "bounty.placed": {
      const d = event.data as LiveEventPayloads["bounty.placed"]
      if (d.opened !== false) {
        return { title: `${who} put a price on ${d.targetName}'s head`, description: `${d.amount} points. Beat them to collect.`, tone: "danger" }
      }
      return {
        title: `The price on ${d.targetName} rises to ${d.total ?? d.amount}`,
        description: `${who} added ${d.amount}${d.backers ? `. ${plural(d.backers, "backer", "backers")} want them gone.` : "."}`,
        tone: "danger",
      }
    }
    case "bounty.claimed": {
      const d = event.data as LiveEventPayloads["bounty.claimed"]
      if (d.legacy) return { title: `The old bounty on ${d.targetName} paid out`, description: `${d.amount} points to its poster.`, tone: "hype" }
      const names = joinNames(d.hunterNames)
      return {
        title: `${d.targetName}'s head collected for ${d.amount} points`,
        description: names ? `Split by ${names}.` : `${plural(d.hunters, "hunter", "hunters")} split it.`,
        tone: "hype",
      }
    }
    case "bounty.escaped": {
      const d = event.data as LiveEventPayloads["bounty.escaped"]
      return {
        title: `${d.targetName} escaped the hunt${d.escapes > 1 ? ` (${d.escapes}x)` : ""}`,
        description:
          d.bonus > 0
            ? `The Crown adds ${d.bonus}. The price is now ${d.total}.`
            : `The Crown already matched every pledge. The price holds at ${d.total}.`,
        tone: "danger",
      }
    }
    case "bounty.expired": {
      const d = event.data as LiveEventPayloads["bounty.expired"]
      return {
        title: `The warrant on ${d.targetName} expired`,
        description: `${d.refunded} points went back to ${plural(d.backers, "backer", "backers")}. They live to int another day.`,
        tone: "info",
      }
    }
    case "shame.posted": {
      const d = event.data as LiveEventPayloads["shame.posted"]
      if (d.source === "tribunal") {
        return { title: `By decree of the Tribunal, ${d.targetName} goes to the pillory`, description: d.message ?? undefined, tone: "roast" }
      }
      return {
        title: `${who} nailed ${d.targetName} to the pillory`,
        description: d.message ? `"${d.message}"` : (d.stat ?? undefined),
        tone: "roast",
      }
    }
    case "shame.egged": {
      const d = event.data as LiveEventPayloads["shame.egged"]
      return {
        title: `${who} egged ${d.targetName}`,
        description: `${plural(d.eggs, "egg", "eggs")} on the face. ${d.extended ? "One more hour on the wall." : "The wall is at its limit, it still stings."}`,
        tone: "roast",
      }
    }
    default:
      return null
  }
}
