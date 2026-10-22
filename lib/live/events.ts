import type { Role, SessionStatus, Side } from "@/lib/types"

// NEXT_PUBLIC_LIVE_TOPIC lets a local dev server listen on a throwaway topic instead of the production one.
export const LIVE_TOPIC = process.env.NEXT_PUBLIC_LIVE_TOPIC || "vvv-live"
export const LIVE_BROADCAST_EVENT = "live"

export interface LiveActor {
  userId: string | null
  name: string
  avatarUrl?: string | null
}

// The optional *UserId fields let clients recognise events aimed at them (personal alerts survive quiet mode).
export interface LiveEventPayloads {
  "session.created": { mode: string }
  "session.status": { from: SessionStatus; to: SessionStatus; winner?: Side | null }
  "session.rerolled": { lockedCount: number }
  "session.lock": { playerName: string; locked: boolean }
  "coachdraft.pick": {
    coachName: string
    playerName: string
    side: Side
    lane?: Role | null
    pickNumber?: number
    nextSide?: Side | null
    targetUserId?: string | null
    playerUserId?: string | null
  }
  "bet.placed": {
    side: Side
    amount: number
    insured: boolean
    raised?: boolean
    total?: number
    allIn?: boolean
    early?: boolean
    whale?: boolean
  }
  "bet.insured": { side: Side; amount: number; premium: number }
  "bet.resolved": {
    winner: Side
    totalPool: number
    topWinner?: { name: string; payout: number; profit?: number } | null
    biggestLoser?: { name: string; loss: number } | null
    allInLosers?: string[]
    refunded?: boolean
    bettors?: number
    insurancePaid?: number
  }
  "chaos.decree": {
    decree: string
    label: string
    cost: number
    targetName?: string | null
    side?: Side | null
    targetUserId?: string | null
    tier?: string
    headline?: string
    actionId?: string
    affectedSide?: Side | null
    changedAssignmentIds?: string[]
    changedPlayerIds?: string[]
  }
  "praise.sung": { excerpt: string; reward: number; praiseId?: string }
  "praise.judged": { verdict: string; authorName: string; delta: number; authorUserId?: string | null; praiseId?: string; note?: string | null }
  "sidebet.placed": { market: string; label: string; amount: number }
  "sidebet.resolved": { market: string; label: string; winners: number; payout: number }
  "bounty.placed": { targetName: string; amount: number; targetUserId?: string | null; total?: number; backers?: number; opened?: boolean }
  "bounty.claimed": { targetName: string; amount: number; hunters: number; targetUserId?: string | null; hunterNames?: string[]; hunterUserIds?: string[]; share?: number; legacy?: boolean }
  "bounty.escaped": { targetName: string; bonus: number; total: number; escapes: number; targetUserId?: string | null }
  "bounty.expired": { targetName: string; refunded: number; backers: number; targetUserId?: string | null }
  "shame.posted": { targetName: string; message?: string | null; targetUserId?: string | null; source?: "user" | "tribunal"; stat?: string | null }
  "shame.egged": { targetName: string; eggs: number; extended: boolean; targetUserId?: string | null }
  "title.equipped": { title: string; perk?: string | null }
  "title.bestowed": { title: string; targetName: string; targetUserId?: string | null; curse?: string | null }
  "title.perk": { title: string; perk: string; delta: number; userId?: string; kind?: "perk" | "curse"; beneficiaryName?: string | null }
  "title.unequipped": { title: string }
  "title.bought": { title: string; price: number }
  "title.claimed": { titles: string[] }
  "title.dignity": { title: string; cost: number; bestowerName?: string | null }
  "title.settled": {
    applications: { userId: string; name: string; title: string; kind: "perk" | "curse"; delta: number; detail: string; beneficiaryId?: string | null; beneficiaryName?: string | null }[]
  }
  "queue.changed": {
    action: "joined" | "left" | "cleared" | "reordered" | "advanced"
    playerName?: string | null
    count?: number
    targetUserId?: string | null
  }
  "vainqueur.changed": {
    action: string
    playerName?: string | null
    targetUserId?: string | null
    targetUserIds?: string[]
    stayed?: string[]
    comingIn?: string[]
    rotatedOut?: string[]
    mode?: string
  }
  "fearless.changed": { action: "cleared" | "removed" | "added"; champion?: string | null }
  "points.changed": { userId: string; delta: number; reason: string }
  "act.changed": { actNumber: number; status: string }
  "duel.challenged": {
    challengerName: string
    opponentName: string | null
    amount: number
    side: Side
    opponentUserId?: string | null
    duelId?: string
  }
  "duel.accepted": {
    challengerName: string
    opponentName: string
    amount: number
    challengerUserId?: string | null
    duelId?: string
    side?: Side
    opponentUserId?: string | null
  }
  "duel.declined": {
    challengerName: string
    opponentName: string
    challengerUserId?: string | null
    duelId?: string
    amount?: number
    opponentUserId?: string | null
  }
  "duel.resolved": {
    winnerName: string
    loserName: string
    amount: number
    winnerUserId?: string | null
    loserUserId?: string | null
    duelId?: string
    payout?: number
    tax?: number
    winnerSide?: Side
  }
  "duel.withdrawn": {
    challengerName: string
    opponentName: string | null
    amount: number
    duelId?: string
    opponentUserId?: string | null
  }
  "duel.expired": { count: number; amount: number; userIds?: string[] }
  "vote.opened": { closesAt: string }
  "vote.cast": { category: string }
  "vote.closed": { mvpName: string | null; interName: string | null }
  "coachdraft.undo": { coachName: string; playerName: string; side: Side; pickNumber: number; targetUserId?: string | null }
  "coachdraft.lanes": { coachName: string; side: Side; lanes: { playerName: string; lane: Role }[] }
  "roster.changed": {
    action: "added" | "renamed" | "benched" | "activated" | "removed"
    playerName: string
    previousName?: string | null
  }
  "profile.linked": { playerName: string }
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

export const ACTIVE_SESSION_KEY = ["session", "active"] as const

// Roots outside the feature list: "activity" holds persisted feed history, "profile" the signed-in user.
export const ACTIVITY_ROOT = "activity"
export const PROFILE_ROOT = "profile"

// Roots that barely change; the healthy background poll skips them (resyncs still refresh them).
export const STABLE_ROOTS: readonly string[] = [PROFILE_ROOT, "acts"]

const RESOLUTION_KEYS = [
  "session",
  "duels",
  "votes",
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
  duel: ["duels", "points"],
  vote: ["votes", "sidebets", "points", "shame"],
  roster: ["sessions", "session", "queue", "vainqueur"],
  profile: ["profile", "leaderboard", "games"],
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
  bounty_warrants: ["bounties"],
  shame_entries: ["shame"],
  user_titles: ["titles"],
  acts: ["acts"],
  prophecy_wagers: ["sidebets", "points"],
  post_game_votes: ["votes", "sidebets", "points"],
  post_game_ballots: ["votes"],
  praises: ["praise"],
  players: ["sessions", "session", "queue", "vainqueur"],
  duels: ["duels"],
}

export const ACTIVE_STATUSES: SessionStatus[] = ["coach_draft", "draft", "chaos", "betting", "in_game"]
export const TIMED_STATUSES: SessionStatus[] = ["chaos", "betting", "in_game"]
export const RESOLVED_STATUSES: SessionStatus[] = ["blue_win", "red_win", "canceled", "expired"]

// An invalidation target: a query-key root, optionally narrowed to one user's ["points", userId, ...] queries.
export interface LiveTarget {
  root: string
  userId?: string
}

// Events whose only balance change is the actor's own: other users' balances do not need a refetch.
const ACTOR_BALANCE_TYPES: ReadonlySet<string> = new Set([
  "bet.placed",
  "bet.insured",
  "chaos.decree",
  "sidebet.placed",
  "bounty.placed",
  "praise.sung",
  "title.equipped",
  "duel.challenged",
  "duel.accepted",
  "duel.withdrawn",
])

export function invalidationTargetsFor(event: LiveEvent): LiveTarget[] {
  const balanceOwner =
    event.type === "points.changed"
      ? (event.data as LiveEventPayloads["points.changed"]).userId
      : ACTOR_BALANCE_TYPES.has(event.type)
        ? event.actor?.userId
        : null
  return invalidationKeysFor(event).map((root) =>
    root === "points" && typeof balanceOwner === "string" && balanceOwner ? { root, userId: balanceOwner } : { root }
  )
}

export function dbTargetsFor(table: string, row: Record<string, unknown> | null | undefined): LiveTarget[] {
  const owner = typeof row?.user_id === "string" ? row.user_id : null
  return (DB_TABLE_KEYS[table] ?? []).map((root) => (root === "points" && owner ? { root, userId: owner } : { root }))
}

export const EVENT_TYPE_PATTERN = /^[a-z][a-z_]{0,23}\.[a-z][a-z_]{0,31}$/

// Too granular or too private for the persisted history; they are still broadcast.
export const EPHEMERAL_EVENT_TYPES: ReadonlySet<string> = new Set(["session.lock", "points.changed", "vote.cast", "title.settled"])

export function isPersistedType(type: string): boolean {
  return EVENT_TYPE_PATTERN.test(type) && !EPHEMERAL_EVENT_TYPES.has(type)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// Avatars come from Discord: a forged event must not make every client load an image from any host.
const AVATAR_HOSTS: readonly string[] = ["https://cdn.discordapp.com/", "https://media.discordapp.net/"]

const safeAvatar = (value: unknown): string | null =>
  typeof value === "string" && value.length <= 512 && AVATAR_HOSTS.some((host) => value.startsWith(host)) ? value : null

function parseActor(value: unknown): LiveActor | null {
  if (!isRecord(value) || typeof value.name !== "string") return null
  return {
    userId: typeof value.userId === "string" ? value.userId : null,
    name: value.name.slice(0, 64),
    avatarUrl: safeAvatar(value.avatarUrl),
  }
}

// Broadcast payloads come from the network (any client can send on a public channel): validate the envelope.
export function parseLiveEvent(value: unknown): LiveEvent | null {
  if (!isRecord(value)) return null
  const { id, type, at, sessionId, actor, data } = value
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null
  if (typeof type !== "string" || !EVENT_TYPE_PATTERN.test(type)) return null
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null
  if (!isRecord(data)) return null
  return {
    id,
    type: type as LiveEventType,
    at,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    actor: parseActor(actor),
    data: data as LiveEventPayloads[LiveEventType],
  }
}

// Shape of a row in the activity_events table (persisted history and its postgres_changes inserts).
export interface ActivityEventRow {
  id: string
  type: string
  session_id: string | null
  actor: unknown
  data: unknown
  created_at: string
}

export function rowToLiveEvent(row: Partial<ActivityEventRow> | null | undefined): LiveEvent | null {
  if (!row) return null
  return parseLiveEvent({
    id: row.id,
    type: row.type,
    at: row.created_at,
    sessionId: row.session_id ?? null,
    actor: row.actor ?? null,
    data: row.data,
  })
}
