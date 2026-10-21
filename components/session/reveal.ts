import { CHAMPION_POOLS, type Champion } from "@/lib/champions"
import type { PlayerRevealState, Role } from "@/lib/types"
import type { RoomSession } from "@/lib/session/types"

const LANES: Role[] = ["top", "jungle", "mid", "adc", "support"]

// Server-anchored timeline: every client derives the same frame from the same timestamps,
// so the slot machine plays in sync for everyone and late joiners land on the right frame.
const LEAD_MS = 1800
const SILHOUETTE_MS = 900
const SHUFFLE_MS = 1150
const LOCK_STAGGER_MS = 280
const LOCK_HOLD_MS = 480
const LANE_GAP_MS = 140
const LANE_WINDOW_MS = SHUFFLE_MS + LOCK_STAGGER_MS + LOCK_HOLD_MS + LANE_GAP_MS
const FRESH_SESSION_MS = 3000
const CANDIDATES_PER_LANE = 10

const SHUFFLE_TICKS: number[] = (() => {
  const ticks: number[] = []
  let at = 0
  let step = 60
  while (at < SHUFFLE_MS) {
    ticks.push(at)
    at += step
    if (at > 520) step = Math.round(step * 1.25)
  }
  return ticks
})()

export interface RevealPlan {
  key: string
  start: number
  duration: number
  players: Map<string, { lane: Role; side: "blue" | "red"; laneIndex: number; staggered: boolean }>
  lanes: Role[]
  candidates: Record<Role, Champion[]>
  finals: string[]
}

export interface RevealFrame {
  states: Map<string, PlayerRevealState>
  shuffle: Map<string, Champion>
  activeLane: Role | null
  progress: number
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickCandidates(lane: Role, seed: string, exclude: Set<string>): Champion[] {
  const pool = CHAMPION_POOLS[lane].filter((c) => !exclude.has(c.internal))
  const ranked = pool.map((c) => ({ c, r: hash(`${seed}:${lane}:${c.internal}`) })).sort((a, b) => a.r - b.r)
  return ranked.slice(0, CANDIDATES_PER_LANE).map((x) => x.c)
}

export function buildRevealPlan(session: RoomSession | null): RevealPlan | null {
  if (!session || session.status !== "draft") return null
  const updatedAt = Date.parse(session.updated_at)
  const createdAt = Date.parse(session.created_at)
  if (Number.isNaN(updatedAt)) return null

  const fresh = Number.isNaN(createdAt) || updatedAt - createdAt < FRESH_SESSION_MS
  const animated = session.session_assignments.filter((a) => fresh || !a.locked)
  if (animated.length === 0) return null

  const lanes = LANES.filter((lane) => animated.some((a) => a.lane === lane))
  const players: RevealPlan["players"] = new Map()
  for (const a of animated) {
    const bothSides = animated.filter((x) => x.lane === a.lane).length > 1
    players.set(a.player_id, {
      lane: a.lane,
      side: a.side,
      laneIndex: lanes.indexOf(a.lane),
      staggered: bothSides && a.side === "red",
    })
  }

  const key = `${session.id}:${session.updated_at}`
  const finals = session.session_assignments.map((a) => a.champion_internal)
  const exclude = new Set(finals)
  const candidates = Object.fromEntries(LANES.map((lane) => [lane, pickCandidates(lane, key, exclude)])) as Record<Role, Champion[]>

  return {
    key,
    start: updatedAt + LEAD_MS,
    duration: SILHOUETTE_MS + lanes.length * LANE_WINDOW_MS,
    players,
    lanes,
    candidates,
    finals,
  }
}

function shuffleTick(elapsed: number): number {
  let index = 0
  while (index + 1 < SHUFFLE_TICKS.length && SHUFFLE_TICKS[index + 1] <= elapsed) index++
  return index
}

export function revealFrame(plan: RevealPlan, t: number): RevealFrame {
  const states = new Map<string, PlayerRevealState>()
  const shuffle = new Map<string, Champion>()
  let activeLane: Role | null = null

  if (t >= SILHOUETTE_MS) {
    const index = Math.floor((t - SILHOUETTE_MS) / LANE_WINDOW_MS)
    activeLane = plan.lanes[index] ?? null
  }

  for (const [playerId, slot] of plan.players) {
    const laneStart = SILHOUETTE_MS + slot.laneIndex * LANE_WINDOW_MS
    const lockAt = laneStart + SHUFFLE_MS + (slot.staggered ? LOCK_STAGGER_MS : 0)
    if (t < laneStart) {
      states.set(playerId, "silhouette")
    } else if (t < lockAt) {
      states.set(playerId, "shuffling")
      const pool = plan.candidates[slot.lane]
      if (pool.length > 0) {
        const offset = hash(playerId) % pool.length
        shuffle.set(playerId, pool[(shuffleTick(t - laneStart) + offset) % pool.length])
      }
    } else if (t < lockAt + LOCK_HOLD_MS) {
      states.set(playerId, "locking")
    } else {
      states.set(playerId, "revealed")
    }
  }

  return { states, shuffle, activeLane, progress: Math.min(1, Math.max(0, t / plan.duration)) }
}
