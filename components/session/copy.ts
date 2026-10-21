import type { SessionStatus, Side } from "@/lib/types"

export type RoomPhase = "lobby" | "coach_draft" | "draft" | "chaos" | "betting" | "in_game" | "result"

export function phaseOf(status: SessionStatus | null | undefined): RoomPhase {
  switch (status) {
    case "coach_draft":
    case "draft":
    case "chaos":
    case "betting":
    case "in_game":
      return status
    case "blue_win":
    case "red_win":
      return "result"
    default:
      return "lobby"
  }
}

export const PHASE_COPY: Record<RoomPhase, { label: string; title: string; line: string }> = {
  lobby: {
    label: "Lobby",
    title: "The Rift awaits",
    line: "Ten souls, five lanes, zero mercy. Pick the roster and let fate deal the cards.",
  },
  coach_draft: {
    label: "Coach Draft",
    title: "Coach Draft",
    line: "Two coaches, ten soldiers, one notebook taking names. Pick wisely.",
  },
  draft: {
    label: "Draft",
    title: "The Draft",
    line: "Fate has dealt. Lock what you love, re-roll what you fear.",
  },
  chaos: {
    label: "Decrees",
    title: "Royal Decrees",
    line: "Ninety seconds to bend the draft. Every decree costs gold, every grudge is remembered.",
  },
  betting: {
    label: "Bets",
    title: "Betting Window",
    line: "Back a side before the gates close. Regret is not refundable.",
  },
  in_game: {
    label: "Live",
    title: "On the Rift",
    line: "Bets are locked. The Charamil holds its breath and pretends not to tilt.",
  },
  result: {
    label: "Result",
    title: "Victory",
    line: "",
  },
}

export const SIDE_NAME: Record<Side, string> = { blue: "Blue side", red: "Red side" }

const VICTORY_LINES = [
  "The Nexus falls. Somewhere, Salaxe insists he called it.",
  "GG. Someone fetch the Shame Board, there is paperwork to do.",
  "A clean victory. No delayed-victory paperwork required.",
  "The little notebook gets a new page tonight.",
  "Le Bon Salaxe would like it noted that he saw this coming. He did not.",
  "Victory. The losers are already typing jungle diff.",
  "The ff15 vote failed and history will remember it.",
  "Chalaksse refreshed the match history twice. Still a win. Still not his.",
]

const CANCEL_LINES = [
  "Called off. The gold goes home, the drama stays.",
  "Canceled. Every bet and decree went back to its owner.",
  "The game was scrapped before the Nexus could fall. Refunds are already in your purse.",
]

function pick(lines: string[], seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return lines[h % lines.length]
}

export function victoryLine(sessionId: string) {
  return pick(VICTORY_LINES, sessionId)
}

export function cancelLine(sessionId: string) {
  return pick(CANCEL_LINES, sessionId)
}

export function waitingLine(phase: RoomPhase, host: string, resolving: string | null): string {
  if (resolving) return `${resolving} is declaring the winner. The scribes are counting the gold.`
  switch (phase) {
    case "coach_draft":
      return "The coaches are drafting. Watch the picks land below."
    case "draft":
      return `Waiting for ${host} to start the game.`
    case "chaos":
      return "Decrees close when the timer runs out. Spend wisely."
    case "betting":
      return "Bets lock when the timer runs out."
    case "in_game":
      return `${host} declares the winner when the Nexus falls.`
    default:
      return ""
  }
}

export function relativeTime(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
