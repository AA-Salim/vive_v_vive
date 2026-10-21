import type { Role, SessionStatus, Side } from "@/lib/types"

export const LIVE_TOPIC = "vvv-live"
export const LIVE_BROADCAST_EVENT = "live"

export interface LiveActor {
  userId: string | null
  name: string
  avatarUrl?: string | null
}

export interface LiveEventPayloads {
  "session.created": { mode: string }
  "session.status": { from: SessionStatus; to: SessionStatus; winner?: Side | null }
  "session.rerolled": { lockedCount: number }
  "session.lock": { playerName: string; locked: boolean }
  "coachdraft.pick": { coachName: string; playerName: string; side: Side; lane?: Role | null }
  "bet.placed": { side: Side; amount: number; insured: boolean }
  "bet.insured": { side: Side; amount: number; premium: number }
  "bet.resolved": { winner: Side; totalPool: number; topWinner?: { name: string; payout: number } | null }
  "chaos.decree": { decree: string; label: string; cost: number; targetName?: string | null; side?: Side | null }
  "praise.sung": { excerpt: string; reward: number }
  "praise.judged": { verdict: string; authorName: string; delta: number }
  "sidebet.placed": { market: string; label: string; amount: number }
  "sidebet.resolved": { market: string; label: string; winners: number; payout: number }
  "bounty.placed": { targetName: string; amount: number }
  "bounty.claimed": { targetName: string; amount: number; hunters: number }
  "shame.posted": { targetName: string; message?: string | null }
  "title.equipped": { title: string }
  "title.bestowed": { title: string; targetName: string }
  "title.perk": { title: string; perk: string; delta: number }
  "queue.changed": { action: "joined" | "left" | "cleared" | "reordered" | "advanced"; playerName?: string | null }
  "vainqueur.changed": { action: string; playerName?: string | null }
  "fearless.changed": { action: "cleared" | "removed" | "added"; champion?: string | null }
  "points.changed": { userId: string; delta: number; reason: string }
  "act.changed": { actNumber: number; status: string }
}

export type LiveEventType = keyof LiveEventPayloads

export interface LiveEvent<T extends LiveEventType = LiveEventType> {
  id: string
  type: T
  at: string
  sessionId: string | null
  actor: LiveActor | null
  data: LiveEventPayloads[T]
}

export type LiveDomain = LiveEventType extends `${infer D}.${string}` ? D : never

export function domainOf(type: LiveEventType): LiveDomain {
  return type.split(".")[0] as LiveDomain
}

const RESOLUTION_KEYS = [
  "session",
  "sessions",
  "bets",
  "chaos",
  "sidebets",
  "bounties",
  "points",
  "fearless",
  "games",
  "titles",
  "leaderboard",
  "praise",
  "vainqueur",
  "queue",
]

const DOMAIN_KEYS: Record<LiveDomain, string[]> = {
  session: ["session", "sessions"],
  coachdraft: ["session", "coachdraft"],
  bet: ["bets", "points", "leaderboard"],
  chaos: ["chaos", "session", "points", "leaderboard"],
  praise: ["praise", "points", "leaderboard"],
  sidebet: ["sidebets", "points"],
  bounty: ["bounties", "points"],
  shame: ["shame"],
  title: ["titles", "points"],
  queue: ["queue"],
  vainqueur: ["vainqueur", "queue"],
  fearless: ["fearless"],
  points: ["points", "leaderboard"],
  act: ["acts"],
}

// Query-key roots to invalidate when an event arrives. Feature queries must start with one of these roots.
export function invalidationKeysFor(event: LiveEvent): string[] {
  if (event.type === "session.status") {
    const to = (event.data as LiveEventPayloads["session.status"]).to
    if (["blue_win", "red_win", "canceled", "expired"].includes(to)) return RESOLUTION_KEYS
    return ["session", "sessions", "bets", "chaos", "sidebets"]
  }
  return DOMAIN_KEYS[domainOf(event.type)] ?? []
}

// Tables whose postgres_changes act as a safety net when a broadcast is missed.
export const DB_TABLE_KEYS: Record<string, string[]> = {
  game_sessions: ["session", "sessions"],
  session_assignments: ["session"],
  bets: ["bets", "points"],
  chaos_actions: ["chaos", "session", "points"],
  coach_draft_picks: ["session", "coachdraft"],
  player_queue: ["queue"],
  vainqueur_state: ["vainqueur", "queue"],
  point_balances: ["points", "leaderboard"],
  daily_fearless: ["fearless"],
  bounties: ["bounties"],
  shame_entries: ["shame"],
  user_titles: ["titles"],
  acts: ["acts"],
}

export const ACTIVE_STATUSES: SessionStatus[] = ["coach_draft", "draft", "chaos", "betting", "in_game"]
export const TIMED_STATUSES: SessionStatus[] = ["chaos", "betting", "in_game"]
