import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"

// Lines for the title events added by the titles feature; lib/live/narration.ts can delegate to this.
export function narrateTitleEvent(event: LiveEvent): Narration | null {
  const who = event.actor?.name ?? "Someone"
  switch (event.type) {
    case "title.equipped": {
      const d = event.data as LiveEventPayloads["title.equipped"]
      return { title: `${who} raised a new banner: ${d.title}`, description: d.perk ?? undefined, tone: "royal" }
    }
    case "title.unequipped": {
      const d = event.data as LiveEventPayloads["title.unequipped"]
      return { title: `${who} lowered the ${d.title} banner`, description: "Back to being nobody. Bold.", tone: "info" }
    }
    case "title.bought": {
      const d = event.data as LiveEventPayloads["title.bought"]
      return { title: `${who} bought the title ${d.title}`, description: `${d.price} points to the Crown.`, tone: "royal" }
    }
    case "title.bestowed": {
      const d = event.data as LiveEventPayloads["title.bestowed"]
      return { title: `${who} branded ${d.targetName} "${d.title}"`, description: d.curse ?? undefined, tone: "roast" }
    }
    case "title.claimed": {
      const d = event.data as LiveEventPayloads["title.claimed"]
      if (d.titles.length === 0) return null
      return d.titles.length === 1
        ? { title: `${who} engraved a new honor: ${d.titles[0]}`, tone: "royal" }
        : { title: `${who} engraved ${d.titles.length} new honors`, description: d.titles.slice(0, 3).join(", "), tone: "royal" }
    }
    case "title.dignity": {
      const d = event.data as LiveEventPayloads["title.dignity"]
      return {
        title: `${who} bought back their dignity`,
        description: `"${d.title}" burned for ${d.cost} points${d.bestowerName ? `. ${d.bestowerName} is devastated.` : "."}`,
        tone: "roast",
      }
    }
    case "title.perk": {
      const d = event.data as LiveEventPayloads["title.perk"]
      return {
        title: d.kind === "curse" ? `${who} paid for wearing "${d.title}"` : `${who}'s "${d.title}" paid out`,
        description: d.perk,
        tone: d.kind === "curse" ? "roast" : "royal",
      }
    }
    default:
      return null
  }
}
