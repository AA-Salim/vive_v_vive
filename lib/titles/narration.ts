import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { effectSummary } from "@/lib/titles/effects"
import { TIER_LABEL, formatPrice, type PriceTier } from "@/lib/titles/pricing"

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : []

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null)

const tierLabel = (value: unknown): string | null =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(TIER_LABEL, value) ? TIER_LABEL[value as PriceTier] : null

const amount = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

// Lines for the title events added by the titles feature; lib/live/narration.ts can delegate to this.
export function narrateTitleEvent(event: LiveEvent): Narration | null {
  const who = event.actor?.name ?? "Someone"
  switch (event.type) {
    case "title.equipped": {
      const d = event.data as LiveEventPayloads["title.equipped"]
      const effect = text(effectSummary(d.title)) ?? strings(d.effects)[0] ?? null
      const worn = strings(d.titles).length
      const description = [effect, text(d.perk) ? `After each game: ${d.perk}` : null, worn > 1 ? `${worn} titles worn` : null]
        .filter(Boolean)
        .join(" · ")
      return { title: `${who} equipped ${d.title}`, description: description || undefined, tone: "royal" }
    }
    case "title.unequipped": {
      const d = event.data as LiveEventPayloads["title.unequipped"]
      return { title: `${who} lowered the ${d.title} banner`, description: "Back to being nobody. Bold.", tone: "info" }
    }
    case "title.bought": {
      const d = event.data as LiveEventPayloads["title.bought"]
      const tier = tierLabel(d.tier)
      const price = amount(d.price)
      const effect = text(d.effect) ?? effectSummary(d.title)
      return {
        title: `${who} bought ${tier ? `the ${tier} title` : "the title"} ${d.title}`,
        description: [price != null ? `${formatPrice(price)} points to the Crown.` : null, effect].filter(Boolean).join(" ") || undefined,
        tone: "royal",
      }
    }
    case "title.bestowed": {
      const d = event.data as LiveEventPayloads["title.bestowed"]
      const price = amount(d.price)
      const effect = text(d.effect) ?? effectSummary(d.title)
      const description = [effect, text(d.curse) ? `After each game: ${d.curse}` : null, price != null ? `Cost ${formatPrice(price)} points.` : null]
        .filter(Boolean)
        .join(" · ")
      return { title: `${who} branded ${d.targetName} "${d.title}"`, description: description || undefined, tone: "roast" }
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
