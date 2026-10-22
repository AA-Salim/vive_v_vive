import { SIDE_NAME, canAfford } from "@/lib/duels/rules"
import type { DuelView, RosterEntry } from "@/lib/duels/types"
import type { Side } from "@/lib/types"

export type RivalBlock = "self" | "teammate" | "no_purse" | "already"

export interface RivalContext {
  viewerId: string
  side: Side
  sideOfPlayer: (playerId: string) => Side | null
  busyWith: ReadonlySet<string>
}

const PAIR_STATUSES = new Set(["open", "accepted", "won", "lost"])

// Accounts the viewer already has a live or fought duel with in this game (one duel per pair per game).
export function rivalsOf(duels: DuelView[], viewerId: string | null): Set<string> {
  const rivals = new Set<string>()
  if (!viewerId) return rivals
  for (const duel of duels) {
    if (!PAIR_STATUSES.has(duel.status) || !duel.opponent) continue
    if (duel.challenger.userId === viewerId) rivals.add(duel.opponent.userId)
    else if (duel.opponent.userId === viewerId) rivals.add(duel.challenger.userId)
  }
  return rivals
}

// Mirrors duel_player_side(): any linked player in the game counts, Blue first.
export function sideOfAccount(playerIds: readonly string[], sideOfPlayer: (playerId: string) => Side | null): Side | null {
  const sides = playerIds.map(sideOfPlayer)
  if (sides.includes("blue")) return "blue"
  if (sides.includes("red")) return "red"
  return null
}

export function rivalBlock(entry: RosterEntry, ctx: RivalContext): RivalBlock | null {
  if (entry.userId === ctx.viewerId) return "self"
  if (!entry.hasPurse) return "no_purse"
  if (ctx.busyWith.has(entry.userId)) return "already"
  if (sideOfAccount(entry.playerIds, ctx.sideOfPlayer) === ctx.side) return "teammate"
  return null
}

export function rivalBlockLabel(block: RivalBlock, side: Side): string {
  switch (block) {
    case "self":
      return "You"
    case "no_purse":
      return "No purse"
    case "already":
      return "Dueling"
    case "teammate":
      return `Plays ${SIDE_NAME[side]}`
  }
}

export type TakeBlock = "own" | "treason" | "purse" | "already" | "signed_out"

// Why the viewer cannot answer an open gauntlet, or null when they can.
export function takeBlock(
  duel: DuelView,
  viewer: { userId: string | null; side: Side | null; balance: number | null },
  rivals: ReadonlySet<string>
): TakeBlock | null {
  if (!viewer.userId) return "signed_out"
  if (duel.challenger.userId === viewer.userId) return "own"
  if (viewer.side && viewer.side === duel.challengerSide) return "treason"
  if (rivals.has(duel.challenger.userId)) return "already"
  if (viewer.balance !== null && !canAfford(viewer.balance, duel.stake)) return "purse"
  return null
}

export function takeBlockLabel(block: TakeBlock, duel: DuelView): string {
  switch (block) {
    case "own":
      return "Your gauntlet"
    case "treason":
      return `You fight for ${SIDE_NAME[duel.challengerSide]}`
    case "already":
      return `Already dueling ${duel.challenger.name}`
    case "purse":
      return "Purse too light"
    case "signed_out":
      return "Sign in to answer"
  }
}
