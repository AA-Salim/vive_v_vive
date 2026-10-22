import {
  ACTIVE_STATUSES,
  TIMED_STATUSES,
  domainOf,
  type LiveEvent,
  type LiveEventPayloads,
} from "@/lib/live/events"
import type { SessionStatus } from "@/lib/types"

export type LivePhase = "idle" | "lobby" | "timed" | "aftermath"

// After a game resolves, payouts, duels, perks and the vote keep flowing for a while.
export const AFTERMATH_MS = 7 * 60_000

export function livePhase(status: SessionStatus | null, endedAt: number | null, now: number): LivePhase {
  if (status && TIMED_STATUSES.includes(status)) return "timed"
  if (status && ACTIVE_STATUSES.includes(status)) return "lobby"
  if (endedAt !== null && now - endedAt < AFTERMATH_MS) return "aftermath"
  return "idle"
}

export interface Viewer {
  userId: string | null
  names: string[]
}

const LOBBY_DOMAINS: ReadonlySet<string> = new Set(["session", "coachdraft", "queue", "vainqueur", "fearless"])

const AFTERMATH_TYPES: ReadonlySet<string> = new Set([
  "bet.resolved",
  "sidebet.resolved",
  "duel.resolved",
  "bounty.claimed",
  "title.perk",
  "vote.opened",
  "vote.cast",
  "vote.closed",
  "shame.posted",
  "shame.egged",
  "bounty.escaped",
  "bounty.expired",
])

// Worth interrupting someone who is not in a game.
const MAJOR_TYPES: ReadonlySet<string> = new Set([
  "session.created",
  "praise.sung",
  "bounty.placed",
  "title.bestowed",
  "act.changed",
  "vote.closed",
])

const sameName = (a: string | null | undefined, names: string[]) =>
  !!a && names.some((n) => n.localeCompare(a, undefined, { sensitivity: "accent" }) === 0)

const isMe = (userId: string | null | undefined, name: string | null | undefined, viewer: Viewer) =>
  (!!viewer.userId && userId === viewer.userId) || (!userId && sameName(name, viewer.names))

// True when the event targets the viewer: these alerts bypass quiet mode and the phase filter.
export function isPersonal(event: LiveEvent, viewer: Viewer): boolean {
  if (!viewer.userId) return false
  switch (event.type) {
    case "duel.challenged": {
      const d = event.data as LiveEventPayloads["duel.challenged"]
      return isMe(d.opponentUserId, d.opponentName, viewer)
    }
    case "duel.accepted":
    case "duel.declined": {
      const d = event.data as LiveEventPayloads["duel.accepted"]
      return isMe(d.challengerUserId, d.challengerName, viewer)
    }
    case "duel.resolved": {
      const d = event.data as LiveEventPayloads["duel.resolved"]
      return isMe(d.winnerUserId, d.winnerName, viewer) || isMe(d.loserUserId, d.loserName, viewer)
    }
    case "bounty.placed":
    case "bounty.escaped":
    case "bounty.expired": {
      const d = event.data as LiveEventPayloads["bounty.placed"]
      return isMe(d.targetUserId, d.targetName, viewer)
    }
    case "bounty.claimed": {
      const d = event.data as LiveEventPayloads["bounty.claimed"]
      return isMe(d.targetUserId, d.targetName, viewer) || (!!d.hunterUserIds && d.hunterUserIds.includes(viewer.userId))
    }
    case "shame.egged": {
      const d = event.data as LiveEventPayloads["shame.egged"]
      return isMe(d.targetUserId, d.targetName, viewer)
    }
    case "coachdraft.pick": {
      const d = event.data as LiveEventPayloads["coachdraft.pick"] & { targetUserId?: string | null; playerUserId?: string | null }
      return (!!d.targetUserId && d.targetUserId === viewer.userId) || (!!d.playerUserId && d.playerUserId === viewer.userId)
    }
    case "coachdraft.undo": {
      const d = event.data as LiveEventPayloads["coachdraft.undo"]
      return !!d.targetUserId && d.targetUserId === viewer.userId
    }
    case "queue.changed":
    case "vainqueur.changed": {
      const d = event.data as { targetUserId?: string | null; targetUserIds?: string[] | null }
      return (!!d.targetUserId && d.targetUserId === viewer.userId) || (!!d.targetUserIds && d.targetUserIds.includes(viewer.userId))
    }
    case "title.bestowed": {
      const d = event.data as LiveEventPayloads["title.bestowed"]
      return isMe(d.targetUserId, d.targetName, viewer)
    }
    case "shame.posted": {
      const d = event.data as LiveEventPayloads["shame.posted"]
      return isMe(d.targetUserId, d.targetName, viewer)
    }
    case "praise.judged": {
      const d = event.data as LiveEventPayloads["praise.judged"]
      return isMe(d.authorUserId, d.authorName, viewer)
    }
    case "chaos.decree": {
      const d = event.data as LiveEventPayloads["chaos.decree"]
      return isMe(d.targetUserId, d.targetName, viewer)
    }
    default:
      return false
  }
}

function isBigMoment(event: LiveEvent): boolean {
  switch (event.type) {
    case "session.created":
    case "bounty.placed":
    case "bounty.claimed":
    case "title.bestowed":
    case "vote.closed":
      return true
    case "session.status": {
      const to = (event.data as LiveEventPayloads["session.status"]).to
      return to === "betting" || to === "in_game" || to === "blue_win" || to === "red_win"
    }
    case "bet.placed":
      return (event.data as LiveEventPayloads["bet.placed"]).amount >= 200
    case "bet.resolved":
      return ((event.data as LiveEventPayloads["bet.resolved"]).topWinner?.payout ?? 0) >= 200
    case "duel.challenged":
      return (event.data as LiveEventPayloads["duel.challenged"]).amount >= 150
    default:
      return false
  }
}

function allowedInPhase(event: LiveEvent, phase: LivePhase): boolean {
  const domain = domainOf(event.type)
  if (domain === "session") return true
  switch (phase) {
    case "timed":
      return true
    case "lobby":
      return LOBBY_DOMAINS.has(domain)
    case "aftermath":
      return AFTERMATH_TYPES.has(event.type) || LOBBY_DOMAINS.has(domain)
    default:
      return false
  }
}

export interface ToastDecision {
  show: boolean
  personal: boolean
  big: boolean
}

const HIDDEN: ToastDecision = { show: false, personal: false, big: false }

export function toastDecision(event: LiveEvent, ctx: { phase: LivePhase; viewer: Viewer; quiet: boolean }): ToastDecision {
  if (ctx.viewer.userId && event.actor?.userId === ctx.viewer.userId) return HIDDEN
  if (isPersonal(event, ctx.viewer)) return { show: true, personal: true, big: true }
  if (ctx.quiet) return HIDDEN
  const show = MAJOR_TYPES.has(event.type) || allowedInPhase(event, ctx.phase)
  return show ? { show, personal: false, big: isBigMoment(event) } : HIDDEN
}

// Events that arrive in bursts share one toast that updates in place instead of stacking.
export function coalesceKey(event: LiveEvent): string | null {
  const scope = event.sessionId ?? "global"
  switch (event.type) {
    case "bet.placed":
    case "bet.insured":
      return `bets:${scope}`
    case "chaos.decree":
      return `decrees:${scope}`
    case "sidebet.placed":
      return `sidebets:${scope}`
    case "vote.cast":
      return `votes:${scope}`
    case "title.perk":
      return `perks:${scope}`
    case "duel.resolved":
      return `duels:${scope}`
    case "queue.changed":
      return "queue"
    default:
      return null
  }
}
