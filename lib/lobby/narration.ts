import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"

const SIDE = { blue: "Blue", red: "Red" } as const

function pick(lines: string[], seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return lines[h % lines.length]
}

function list(names: string[] | undefined, max = 3): string {
  const clean = (names ?? []).filter(Boolean)
  if (clean.length <= max) return clean.join(", ")
  return `${clean.slice(0, max).join(", ")} +${clean.length - max}`
}

function queueLine(event: LiveEvent, who: string): Narration | null {
  const d = event.data as LiveEventPayloads["queue.changed"]
  const name = d.playerName ?? "Someone"
  const self = !event.actor?.name || event.actor.name === d.playerName
  switch (d.action) {
    case "joined":
      return {
        title: self
          ? pick([`${name} takes a number`, `${name} lines up for the Rift`, `${name} joins the queue`], event.id)
          : `${who} put ${name} in the queue`,
        description: d.count ? `#${d.count} in line.` : undefined,
        tone: "info",
      }
    case "left":
      return {
        title: self ? `${name} left the queue` : `${who} pulled ${name} out of the queue`,
        description: pick(["The line moves up.", "Cold feet, or dinner. History will decide."], event.id),
        tone: "info",
      }
    case "cleared":
      return { title: `${who} cleared the queue`, description: "Everyone back to the lobby. Re-queue if you still believe.", tone: "info" }
    case "reordered":
      return { title: `${who} reshuffled the queue`, description: d.playerName ? `${d.playerName} changed places.` : undefined, tone: "info" }
    case "advanced":
      return null
  }
}

function rotationLine(event: LiveEvent, who: string): Narration | null {
  const d = event.data as LiveEventPayloads["vainqueur.changed"]
  const name = d.playerName ?? "Someone"
  switch (d.action) {
    case "activated":
      return { title: "Winner stays is on", description: "Winners keep their seats. Losers make room for the queue.", tone: "royal" }
    case "deactivated":
      return { title: "Winner stays is off", description: `${who} vacated the throne. Back to open rolls.`, tone: "info" }
    case "volunteered":
      return { title: `${name} begs to stay`, description: "Volunteers keep their seat first when the queue runs short.", tone: "roast" }
    case "unvolunteered":
      return { title: `${name} withdrew the plea`, description: "Pride restored. Probably.", tone: "info" }
    case "sat_out":
      return { title: `${name} gave up a winner's seat`, description: "Noble, or tired. The queue gets one more spot.", tone: "royal" }
    case "returned":
      return { title: `${name} took their seat back`, description: "The throne is still warm.", tone: "info" }
    case "rotated": {
      const incoming = list(d.comingIn)
      const leaving = list(d.rotatedOut)
      return {
        title: d.mode === "shuffle" ? "The rotation turned: all ten reshuffled" : "The champions defend the throne",
        description: [incoming && `${incoming} step in.`, leaving && `${leaving} take a number.`].filter(Boolean).join(" ") || undefined,
        tone: "hype",
      }
    }
    default:
      return null
  }
}

function rosterLine(event: LiveEvent, who: string): Narration | null {
  const d = event.data as LiveEventPayloads["roster.changed"]
  switch (d.action) {
    case "added":
      return { title: `${d.playerName} joins the roster`, description: "Fresh blood for the Rift.", tone: "info" }
    case "renamed":
      return { title: `${d.previousName ?? "A player"} is now ${d.playerName}`, description: "New name, same mechanics.", tone: "info" }
    case "benched":
      return { title: `${who} benched ${d.playerName}`, description: "Off the active roster until further notice.", tone: "roast" }
    case "activated":
      return { title: `${d.playerName} is back on the roster`, description: "Back from exile. The little notebook has been informed.", tone: "info" }
    case "removed":
      return { title: `${d.playerName} was struck from the roster`, tone: "info" }
  }
}

// Lines for queue, rotation, coach draft and roster events; lib/live/narration.ts can delegate to this.
export function narrateLobbyEvent(event: LiveEvent): Narration | null {
  const who = event.actor?.name ?? "Someone"
  switch (event.type) {
    case "queue.changed":
      return queueLine(event, who)
    case "vainqueur.changed":
      return rotationLine(event, who)
    case "roster.changed":
      return rosterLine(event, who)
    case "coachdraft.pick": {
      const d = event.data as LiveEventPayloads["coachdraft.pick"]
      return {
        title: `${d.coachName} drafts ${d.playerName}`,
        description: d.pickNumber ? `Pick ${d.pickNumber} of 10 for ${SIDE[d.side]}.` : `For ${SIDE[d.side]}.`,
        tone: d.pickNumber === 10 ? "hype" : "info",
      }
    }
    case "coachdraft.undo": {
      const d = event.data as LiveEventPayloads["coachdraft.undo"]
      return {
        title: `${d.coachName} took back ${d.playerName}`,
        description: `Pick ${d.pickNumber} is open again. The notebook allows one eraser.`,
        tone: "roast",
      }
    }
    default:
      return null
  }
}
