import type { LiveEvent, LiveEventPayloads, LiveEventType, TitleFlair } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { actorName, count, display, pts, say, sideName, text, type LineTemplate } from "@/lib/lore/herald/kit"

// Title flair on live events: the Herald shouts every bet, decree and duel of a Main Character, and any event that
// a title changed says which title did what.

const HERALD_TYPES: ReadonlySet<LiveEventType> = new Set(["bet.placed", "chaos.decree", "duel.challenged", "duel.accepted"])

const MAX_EFFECT_LINES = 3
const MAX_EFFECT_CHARS = 140

export function isHeraldEvent(event: LiveEvent): boolean {
  return HERALD_TYPES.has(event.type) && (event.data as TitleFlair).herald === true
}

// Payloads come off the network: keep only short strings.
export function titleEffectLines(event: LiveEvent): string[] {
  const lines = (event.data as TitleFlair).titleEffects
  if (!Array.isArray(lines)) return []
  return lines
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .slice(0, MAX_EFFECT_LINES)
    .map((line) => line.trim().slice(0, MAX_EFFECT_CHARS))
}

const BET: LineTemplate[] = [
  { title: "HEAR YE: the Main Character bets {amount} on {side}", description: "{who} insists this is their story. The Herald was paid to agree." },
  { title: "Trumpets, please: {who} backs {side} with {amount}", description: "A self-diagnosed protagonist has entered the market." },
  { title: "{who}, star of their own saga, puts {amount} on {side}", description: "The court is contractually obliged to watch." },
]

const DECREE: LineTemplate[] = [
  { title: "HEAR YE: the Main Character decrees {label}", description: "{who} signs with a flourish nobody asked for." },
  { title: "Fanfare for {who}: {label}", description: "The protagonist bends the draft. Supporting cast, adjust." },
  { title: "{who} rewrites the plot: {label}", description: "Plot armor: equipped. Humility: not found." },
]

const CHALLENGE: LineTemplate[] = [
  { title: "HEAR YE: the Main Character throws a gauntlet at {opponent}", description: "{amount} points on {side}. A duel worthy of a trailer." },
  { title: "{who} demands a duel, cameras rolling", description: "{amount} points on {side}, opponent: {opponent}." },
  { title: "Season finale energy: {who} challenges {opponent}", description: "{amount} points. The Herald is already writing the recap." },
]

const ACCEPT: LineTemplate[] = [
  { title: "HEAR YE: the Main Character accepts {challenger}'s duel", description: "{amount} points. Every protagonist needs a rival arc." },
  { title: "{who} answers {challenger}: the duel is on", description: "{amount} points, and a soundtrack only {who} can hear." },
]

function heraldLine(event: LiveEvent, base: Narration): Narration {
  const who = actorName(event)
  switch (event.type) {
    case "bet.placed": {
      const d = event.data as LiveEventPayloads["bet.placed"]
      const amount = count(d.raised ? d.total : d.amount) || count(d.amount)
      return say(event, "herald-bet", BET, { who, amount: pts(amount), side: sideName(d.side) }, "hype")
    }
    case "chaos.decree": {
      const d = event.data as LiveEventPayloads["chaos.decree"]
      const line = say(event, "herald-decree", DECREE, { who, label: text(d.label) ?? "a royal decree" }, "royal")
      return { ...line, description: [line.description, base.description].filter(Boolean).join(" ") }
    }
    case "duel.challenged": {
      const d = event.data as LiveEventPayloads["duel.challenged"]
      const values = { who, opponent: display(d.opponentName) ?? "the whole court", amount: pts(count(d.amount)), side: sideName(d.side) }
      return say(event, "herald-duel", CHALLENGE, values, "hype")
    }
    case "duel.accepted": {
      const d = event.data as LiveEventPayloads["duel.accepted"]
      const values = { who, challenger: display(d.challengerName) ?? "someone", amount: pts(count(d.amount)) }
      return say(event, "herald-accept", ACCEPT, values, "hype")
    }
    default:
      return base
  }
}

export function withTitleFlair(event: LiveEvent, base: Narration | null): Narration | null {
  if (!base) return null
  const line = isHeraldEvent(event) ? heraldLine(event, base) : base
  const effects = titleEffectLines(event)
  if (effects.length === 0) return line
  return { ...line, description: [line.description, effects.join(" · ")].filter(Boolean).join(" ") }
}
