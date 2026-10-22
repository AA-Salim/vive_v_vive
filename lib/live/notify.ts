import { domainOf, type LiveEvent, type LiveEventPayloads } from "@/lib/live/events"
import { safeNarrate } from "@/lib/live/coalesce"
import { liveTone, type LiveTone } from "@/lib/live/tone"
import type { SessionStatus } from "@/lib/types"

// Which live events become an OS notification (tab hidden, app minimized) and a Web Push (app closed).
// Shared by the server sender, the tab notifier and the sender's "everyone was notified" confirmation.
export interface NotifyPlan {
  // null: every subscriber except the actor. A list: only those users (personal alerts).
  userIds: string[] | null
  // Notifications with the same tag replace each other: one per game for its lifecycle, one per kind of alert.
  tag: string
  // Throttle scope on the server: at most one push per scope per few seconds.
  scope: string
  url: string
  // Short name of what went out, for the sender's confirmation ("Everyone was notified: bets open").
  label: string
  // Who a personal alert reached, for the same confirmation.
  targetName: string | null
  urgent: boolean
  ttlSeconds: number
  // Personal alerts read better addressed to the reader; the narration line then becomes the body.
  headline?: string
  action?: string
  // Frequent alerts (draft picks) skip the sender's confirmation toast.
  confirm: boolean
}

export interface NotifyContent {
  title: string
  body: string
  tone: LiveTone
}

export interface PushPayload extends NotifyContent {
  v: 1
  id: string
  type: string
  sessionId: string | null
  tag: string
  url: string
  personal: boolean
  at: string
  action?: string
}

const STATUS_LABEL: Partial<Record<SessionStatus, string>> = {
  chaos: "decrees open",
  betting: "bets open",
  in_game: "game live",
  blue_win: "result",
  red_win: "result",
  canceled: "game canceled",
}

const id = (value: unknown): string | null => (typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null)
const name = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, 64) : null)

function announcement(event: LiveEvent, label: string, tag: string, extra: Partial<NotifyPlan> = {}): NotifyPlan {
  const scope = event.sessionId ?? "global"
  return {
    userIds: null,
    tag,
    scope: `s:${scope}`,
    url: "/",
    label,
    targetName: null,
    urgent: true,
    ttlSeconds: 20 * 60,
    confirm: true,
    ...extra,
  }
}

function personal(
  event: LiveEvent,
  target: unknown,
  targetName: unknown,
  label: string,
  extra: Partial<NotifyPlan> = {}
): NotifyPlan | null {
  const userId = id(target)
  if (!userId || userId === event.actor?.userId) return null
  const scope = event.sessionId ?? "global"
  return {
    userIds: [userId],
    tag: `vvv-me-${domainOf(event.type)}-${scope}`,
    scope: `u:${userId}:${scope}`,
    url: "/",
    label,
    targetName: name(targetName),
    urgent: true,
    ttlSeconds: 60 * 60,
    confirm: true,
    ...extra,
  }
}

export function notifyPlan(event: LiveEvent): NotifyPlan | null {
  const lifecycle = `vvv-game-${event.sessionId ?? "global"}`
  switch (event.type) {
    case "session.created":
      return announcement(event, "new game", lifecycle, { action: "Join the lobby" })
    case "session.status": {
      const label = STATUS_LABEL[(event.data as LiveEventPayloads["session.status"]).to]
      return label ? announcement(event, label, lifecycle) : null
    }
    case "vote.opened":
      return announcement(event, "Tribunal open", `vvv-tribunal-${event.sessionId ?? "global"}`, { action: "Cast your vote" })
    case "duel.challenged": {
      const d = event.data as LiveEventPayloads["duel.challenged"]
      return personal(event, d.opponentUserId, d.opponentName, "duel challenge", { action: "Answer the duel" })
    }
    case "duel.accepted": {
      const d = event.data as LiveEventPayloads["duel.accepted"]
      return personal(event, d.challengerUserId, d.challengerName, "duel accepted")
    }
    case "bounty.placed": {
      const d = event.data as LiveEventPayloads["bounty.placed"]
      return personal(event, d.targetUserId, d.targetName, "bounty")
    }
    case "title.bestowed": {
      const d = event.data as LiveEventPayloads["title.bestowed"]
      return personal(event, d.targetUserId, d.targetName, d.curse ? "curse" : "title", { url: "/titles" })
    }
    case "shame.posted": {
      const d = event.data as LiveEventPayloads["shame.posted"]
      return personal(event, d.targetUserId, d.targetName, "pillory")
    }
    case "praise.judged": {
      const d = event.data as LiveEventPayloads["praise.judged"]
      return personal(event, d.authorUserId, d.authorName, "verdict")
    }
    case "coachdraft.pick": {
      const d = event.data as LiveEventPayloads["coachdraft.pick"]
      return personal(event, d.targetUserId, "The other coach", "their turn to pick", {
        headline: "Your pick, coach",
        ttlSeconds: 5 * 60,
        confirm: false,
      })
    }
    default:
      return null
  }
}

export function notifyContent(event: LiveEvent, plan: NotifyPlan): NotifyContent | null {
  const line = safeNarrate(event)
  if (!line) return null
  const description = line.description?.trim() ?? ""
  const tone = liveTone(line.tone)
  if (plan.headline) return { title: plan.headline, body: description ? `${line.title}. ${description}` : line.title, tone }
  if (event.type === "session.created") {
    return { title: line.title, body: description ? `${description} Join the lobby.` : "Join the lobby.", tone }
  }
  return { title: line.title, body: description, tone }
}

export function pushPayload(event: LiveEvent, plan: NotifyPlan, content: NotifyContent): PushPayload {
  return {
    v: 1,
    id: event.id,
    type: event.type,
    sessionId: event.sessionId,
    tag: plan.tag,
    url: plan.url,
    personal: plan.userIds !== null,
    at: event.at,
    action: plan.action,
    ...content,
  }
}

// The line shown to whoever caused the announcement, instead of a toast about their own action.
export function sentConfirmation(plan: NotifyPlan): string | null {
  if (!plan.confirm) return null
  if (plan.userIds === null) return `Everyone was notified: ${plan.label}`
  return plan.targetName ? `${plan.targetName} was notified: ${plan.label}` : `They were notified: ${plan.label}`
}
