import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration, NarrationTone } from "@/lib/live/narration"
import { actorName, count, display, pickText, pts, say, sideName, text, type LineTemplate } from "@/lib/lore/herald/kit"
import { isSalaxe, mentionsSalaxe } from "@/lib/lore/salaxe"

const DECREE_TITLES: Record<string, LineTemplate[]> = {
  plain: [
    { title: "{who} decreed {label}" },
    { title: "{who} signed {label}" },
    { title: "By order of {who}: {label}" },
    { title: "{who} invoked {label}" },
  ],
  sabotage: [
    { title: "{who} cast {label} on {target}" },
    { title: "Sabotage: {who} signed {label}" },
    { title: "{who} turned {label} against {target}" },
  ],
  cataclysm: [
    { title: "{who} unleashed {label}" },
    { title: "Cataclysm: {who} decreed {label}" },
    { title: "{who} signed {label}. Brace yourselves" },
  ],
  salaxe: [
    { title: "Salaxe signed {label} from exile" },
    { title: "The exiled King decrees {label}" },
    { title: "Salaxe reaches for the quill: {label}" },
  ],
  onSalaxe: [
    { title: "{who} decreed {label} on Salaxe" },
    { title: "Treason: {who} targets Salaxe with {label}" },
  ],
}

const DECREE_FALLBACKS = [
  "{cost} points to the Crown. The draft bends.",
  "Signed, sealed and paid: {cost} points.",
  "The ink is dry. {cost} points well spent, or not.",
]

export function narrateDecree(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["chaos.decree"]
  const who = actorName(event)
  const target = display(d.targetName)
  const values = {
    who,
    label: text(d.label) ?? "a royal decree",
    target: target ?? sideName(d.side ?? null),
    cost: pts(count(d.cost)),
    side: sideName(d.side ?? null),
  }
  const hostile = d.tier === "sabotage" || d.tier === "cataclysm"
  const kind = isSalaxe(who)
    ? "salaxe"
    : isSalaxe(target)
      ? "onSalaxe"
      : d.tier === "cataclysm"
        ? "cataclysm"
        : d.tier === "sabotage" && target
          ? "sabotage"
          : "plain"
  const tone: NarrationTone = hostile ? "danger" : "royal"
  const line = say(event, `decree-${kind}`, DECREE_TITLES[kind], values, tone)
  line.description =
    text(d.headline) ?? (target ? `Target: ${target}.` : pickText(event, "decree-cost", DECREE_FALLBACKS, values))
  return line
}

const SUNG: LineTemplate[] = [
  { title: "{who} sang for Salaxe" },
  { title: "{who} composed an ode to the exile" },
  { title: "A new hymn from {who}" },
  { title: "{who} knelt and sang His praises" },
]

export function narratePraise(event: LiveEvent): Narration | null {
  if (event.type === "praise.sung") {
    const d = event.data as LiveEventPayloads["praise.sung"]
    const line = say(event, "sung", SUNG, { who: actorName(event) }, "royal")
    const excerpt = text(d.excerpt)
    line.description = excerpt
      ? `"${excerpt}"`
      : pickText(event, "sung-empty", [
          "The exiled King is listening. Intently. Suspiciously.",
          "A verse for the notebook's good column.",
        ])
    return line
  }
  if (event.type === "praise.judged") {
    const d = event.data as LiveEventPayloads["praise.judged"]
    const delta = count(d.delta)
    const verdict = text(d.verdict)
    const values = {
      judge: actorName(event, "Salaxe"),
      author: display(d.authorName) ?? "Someone",
      verdict: verdict ? verdict.charAt(0).toUpperCase() + verdict.slice(1) : "Judged",
      delta: pts(Math.abs(delta)),
    }
    if (delta > 0) {
      return say(event, "judged-up", [
        { title: "{judge} blessed {author}'s praise", description: "{verdict}. +{delta} from the exiled treasury." },
        { title: "{author}'s hymn moved the exile", description: "{verdict}. +{delta}, paid with a trembling hand." },
        { title: "{author} found favor with the crown", description: "{verdict}. +{delta}, and a promotion in the notebook." },
      ], values, "royal")
    }
    if (delta < 0) {
      return say(event, "judged-down", [
        { title: "{judge} rejected {author}'s praise", description: "{verdict}. -{delta} for insufficient groveling." },
        { title: "{author}'s hymn fell flat", description: "{verdict}. The exile charges {delta} for emotional damages." },
      ], values, "roast")
    }
    return say(event, "judged-flat", [
      { title: "{judge} read {author}'s praise", description: "{verdict}. No reward, no punishment. Just a long stare." },
      { title: "{author}'s hymn was noted", description: "{verdict}. The exile neither weeps nor pays." },
    ], values, "info")
  }
  return null
}

export function narrateShame(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["shame.posted"]
  const who = actorName(event)
  const target = display(d.targetName) ?? "Someone"
  const message = text(d.message)
  const values = { who, target }
  if (isSalaxe(target)) {
    const line = say(event, "shame-slx", [
      { title: "{who} shamed Salaxe" },
      { title: "Lèse-majesté: {who} posted Salaxe on the Shame Board" },
    ], values, "roast")
    line.description = message ? `"${message}"` : "The notebook just caught fire."
    return line
  }
  if (isSalaxe(who)) {
    const line = say(event, "shame-by-slx", [
      { title: "Salaxe nailed {target} to the Shame Board" },
      { title: "From exile, Salaxe shames {target}" },
    ], values, "roast")
    line.description = message ? `"${message}"` : "With love, and a very large hammer."
    return line
  }
  const line = say(event, "shame", [
    { title: "{who} nailed {target} to the Shame Board" },
    { title: "{target} has been publicly shamed" },
    { title: "{who} posted {target} on the Shame Board" },
  ], values, "roast")
  line.description = message
    ? `"${message}"`
    : pickText(event, "shame-desc", [
        "The court will read it. Twice.",
        "A crowd gathers. Someone brought tomatoes.",
        "The board remembers everything. So does the group chat.",
      ])
  return line
}

function displayList(value: unknown): string | null {
  const names = text(value)
  return names ? names.split(" & ").map((n) => display(n) ?? n).join(" & ") : null
}

function others(names: string): string | null {
  const rest = names.split(" & ").filter((n) => !isSalaxe(n))
  return rest.length > 0 ? rest.join(" & ") : null
}

// The Salaxe lines steal the headline; the rest of the verdict still gets read out.
function withVerdictNotes(
  line: Narration,
  notes: { shared?: string | null; sharedInter?: string | null; mvp?: string | null; inter?: string | null }
): Narration {
  const extra = [
    notes.shared ? `Crown shared with ${notes.shared}.` : null,
    notes.sharedInter ? `Conviction shared with ${notes.sharedInter}.` : null,
    notes.mvp ? `MVP: ${notes.mvp}.` : null,
    notes.inter ? `Inter: ${notes.inter}.` : null,
  ].filter((n): n is string => !!n)
  return extra.length > 0 ? { ...line, description: [line.description, ...extra].filter(Boolean).join(" ") } : line
}

function minutesBetween(fromIso: string, toIso: string): number | null {
  const ms = Date.parse(toIso) - Date.parse(fromIso)
  return Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : null
}

export function narrateVote(event: LiveEvent): Narration | null {
  if (event.type === "vote.opened") {
    const d = event.data as LiveEventPayloads["vote.opened"]
    const minutes = minutesBetween(event.at, d.closesAt)
    const closes = minutes ? `Polls close in ${minutes} min.` : "Polls close soon."
    return say(event, "vote-open", [
      { title: "The Tribunal is in session", description: "Crown the MVP, name the Inter. {closes}" },
      { title: "The court convenes", description: "Vote MVP and Inter. Prophets, hold your breath. {closes}" },
      { title: "Tribunal open: judge your peers", description: "One vote for glory, one for shame. {closes}" },
    ], { closes }, "royal")
  }
  if (event.type === "vote.closed") {
    const d = event.data as LiveEventPayloads["vote.closed"]
    const mvp = displayList(d.mvpName)
    const inter = displayList(d.interName)
    const values = { mvp: mvp ?? "", inter: inter ?? "" }
    if (mvp && mentionsSalaxe(mvp)) {
      const line = say(event, "verdict-slx-mvp", [
        { title: "Salaxe crowned MVP", description: "He says this proves the exile was a clerical error. It proves one game." },
        { title: "The Tribunal crowns the exiled King", description: "For one game. Do not let him turn it into a whole Act." },
      ], values, "royal")
      return withVerdictNotes(line, { shared: others(mvp), inter })
    }
    if (inter && mentionsSalaxe(inter)) {
      const line = say(event, "verdict-slx-inter", [
        { title: "Salaxe named the Inter", description: "He calls the vote rigged and has written down every voter. Every single one." },
        { title: "The court convicts the exiled King", description: "The crown slips a little further. The notebook gets thicker." },
      ], values, "roast")
      return withVerdictNotes(line, { sharedInter: others(inter), mvp })
    }
    if (mvp && inter) {
      return say(event, "verdict-both", [
        { title: "The Tribunal has spoken", description: "MVP: {mvp}. Inter: {inter}. Appeals go to the notebook." },
        { title: "{mvp} crowned, {inter} condemned", description: "Glory and gray screens, distributed fairly." },
        { title: "Verdict: {mvp} MVP, {inter} Inter", description: "One gets a crown, the other gets a nickname." },
      ], values, "royal")
    }
    if (mvp) {
      return say(event, "verdict-mvp", [
        { title: "{mvp} crowned MVP", description: "No Inter convicted. Everyone inted equally, apparently." },
        { title: "The Tribunal crowns {mvp}", description: "No Inter convicted. The guilty walk free, for now." },
      ], values, "royal")
    }
    if (inter) {
      return say(event, "verdict-inter", [
        { title: "{inter} named the Inter", description: "No MVP this time. The court found nobody worthy of a crown." },
        { title: "The Tribunal condemns {inter}", description: "A conviction, but no coronation." },
      ], values, "roast")
    }
    return say(event, "verdict-none", [
      { title: "The Tribunal adjourned without a verdict", description: "Too few votes. Justice is postponed, like a Salaxe victory." },
      { title: "No verdict this time", description: "The court could not agree. Very on brand." },
    ], values, "info")
  }
  return null
}
