import type { ChaosActionType } from "@/lib/types"

export type DecreeType = ChaosActionType | "royal_pardon"

export type DecreeTier = "wager" | "favor" | "sabotage" | "cataclysm"

export type DecreeTargeting = "side" | "self" | "player" | "teammate" | "two_teammates" | "team"

export type PointsReason = "chaos_spent" | "sabotage_spent"

export interface DecreeDef {
  type: DecreeType
  tier: DecreeTier
  dbTier: "medium" | "high" | "super" | "sabotage" | "ward"
  name: string
  short: string
  effect: string
  legacyEffect?: string
  flavor: string
  cost: number
  maxUses: number
  limitGroup: string
  targeting: DecreeTargeting
  playersOnly: boolean
  hostile: boolean
  changesDraft: boolean
  requiresV2: boolean
  retired: boolean
  reason: PointsReason
}

// Mirrored in chaos_wager_multiplier() (supabase/phase10_chaos.sql): 2x, +0.5x for one hostile decree, 2.5x at most.
export const WAGER_BASE_MULTIPLIER = 2
export const WAGER_DEFIANCE_STEP = 0.5
export const WAGER_MAX_DEFIANCE = 1
export const WAGER_MAX_MULTIPLIER = WAGER_BASE_MULTIPLIER + WAGER_DEFIANCE_STEP * WAGER_MAX_DEFIANCE
export const DEBT_FLOOR = -300
export const WINDOW_GRACE_MS = 3000

export const TIER_LABELS: Record<DecreeTier, string> = {
  wager: "Wager",
  favor: "Favor",
  sabotage: "Sabotage",
  cataclysm: "Cataclysm",
}

export const TARGETING_LABELS: Record<DecreeTargeting, string> = {
  side: "Back a side",
  self: "Yourself",
  player: "Any player",
  teammate: "A teammate",
  two_teammates: "Two teammates",
  team: "A whole team",
}

const DECREES: DecreeDef[] = [
  {
    type: "double_or_nothing",
    tier: "wager",
    dbTier: "medium",
    name: "The King's Wager",
    short: "Back a side. Win and the treasury pays double.",
    effect: `Stake on Blue or Red. If they win you collect ${WAGER_BASE_MULTIPLIER}x. A hostile decree someone else lands on your side after you wager adds +${WAGER_DEFIANCE_STEP}x, up to ${WAGER_MAX_MULTIPLIER}x. Players can only back their own team, and all your wagers in a game ride on one side.`,
    legacyEffect: `Stake on Blue or Red. If they win you collect ${WAGER_BASE_MULTIPLIER}x. Players can only back their own team, and all your wagers in a game ride on one side.`,
    flavor: "Salaxe once bet the whole crown on a solo Baron. Learn from him. Or do not.",
    cost: 49,
    maxUses: 3,
    limitGroup: "wager",
    targeting: "side",
    playersOnly: false,
    hostile: false,
    changesDraft: false,
    requiresV2: false,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "royal_pardon",
    tier: "favor",
    dbTier: "ward",
    name: "Royal Pardon",
    short: "Shield one player from everyone's decrees.",
    effect:
      "Pick any player in this game. Until it ends, other people's decrees cannot touch their lane or champion: no exiles, no forced marches, no usurped seats, and team-wide decrees skip them.",
    flavor: "Signed in exile, sealed with Chalaksse's thumbprint. Mostly legally binding.",
    cost: 59,
    maxUses: 1,
    limitGroup: "pardon",
    targeting: "player",
    playersOnly: false,
    hostile: false,
    changesDraft: false,
    requiresV2: true,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "reroll_self",
    tier: "favor",
    dbTier: "high",
    name: "Royal Makeover",
    short: "Reroll your own champion. Same lane, new face.",
    effect:
      "Your champion is rerolled for your lane: guaranteed different, never one already in this game, and never one played today unless the pool runs dry.",
    flavor: "Even the King had a 0/8 Yone phase. Burn the evidence.",
    cost: 59,
    maxUses: 1,
    limitGroup: "reroll_self",
    targeting: "self",
    playersOnly: true,
    hostile: false,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "champion_ban",
    tier: "sabotage",
    dbTier: "sabotage",
    name: "Exile a Champion",
    short: "Banish a player's champion. They roll again.",
    effect:
      "Pick another player. Their champion is exiled for the rest of this game and they roll a new one for the same lane. No later decree can bring the exile back.",
    flavor: "Written in the little notebook. Underlined twice.",
    cost: 75,
    maxUses: 1,
    limitGroup: "sabotage",
    targeting: "player",
    playersOnly: false,
    hostile: true,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "sabotage_spent",
  },
  {
    type: "swap_teammate",
    tier: "favor",
    dbTier: "high",
    name: "Usurp a Seat",
    short: "Trade lane and champion with a teammate.",
    effect: "Pick a teammate. You take their lane and champion, they take yours. They do not get a vote.",
    flavor: "Taking what is not yours: the oldest tradition of the court.",
    cost: 89,
    maxUses: 1,
    limitGroup: "swap",
    targeting: "teammate",
    playersOnly: true,
    hostile: false,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "lane_force",
    tier: "sabotage",
    dbTier: "sabotage",
    name: "Forced March",
    short: "Two teammates trade lanes. Champions stay.",
    effect:
      "Pick two players on the same team, neither of them you. They swap lanes but keep their champions. Enjoy your Soraka top.",
    flavor: "The map is a suggestion. The King's word is law.",
    cost: 99,
    maxUses: 1,
    limitGroup: "sabotage",
    targeting: "two_teammates",
    playersOnly: false,
    hostile: true,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "sabotage_spent",
  },
  {
    type: "shuffle_lanes",
    tier: "cataclysm",
    dbTier: "super",
    name: "Musical Thrones",
    short: "Everyone on a team changes seats.",
    effect:
      "Pick a team. Every unpardoned player moves into another player's seat, lane and champion included. Nobody keeps their own.",
    flavor: "When the music stops, someone is jungling. It is never the jungler.",
    cost: 119,
    maxUses: 1,
    limitGroup: "shuffle",
    targeting: "team",
    playersOnly: false,
    hostile: true,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "reroll_champs",
    tier: "cataclysm",
    dbTier: "super",
    name: "The Purge",
    short: "Reroll every champion on a team.",
    effect:
      "Pick a team. Every unpardoned player gets a brand new champion for their lane. No repeats, and nobody keeps their own.",
    flavor: "Five comfort picks walk in. Five strangers walk out.",
    cost: 139,
    maxUses: 1,
    limitGroup: "purge",
    targeting: "team",
    playersOnly: false,
    hostile: true,
    changesDraft: true,
    requiresV2: false,
    retired: false,
    reason: "chaos_spent",
  },
  {
    type: "target_reroll",
    tier: "sabotage",
    dbTier: "super",
    name: "Targeted Reroll",
    short: "Retired. Its duties pass to Exile a Champion.",
    effect: "Rerolled one player's champion. Retired by royal decree: Exile a Champion does it better for less.",
    flavor: "Pensioned off with a modest stipend and a commemorative plaque.",
    cost: 139,
    maxUses: 0,
    limitGroup: "target_reroll",
    targeting: "player",
    playersOnly: false,
    hostile: true,
    changesDraft: true,
    requiresV2: false,
    retired: true,
    reason: "chaos_spent",
  },
]

export const ALL_DECREES: readonly DecreeDef[] = DECREES

const BY_TYPE = new Map<string, DecreeDef>(DECREES.map((d) => [d.type, d]))

export function getDecree(type: string): DecreeDef | undefined {
  return BY_TYPE.get(type)
}

export function decreeName(type: string): string {
  return BY_TYPE.get(type)?.name ?? "A royal decree"
}

export const BOARD_DECREES: DecreeDef[] = DECREES.filter((d) => !d.retired)

export const HOSTILE_TYPES = new Set<string>(DECREES.filter((d) => d.hostile).map((d) => d.type))
