import type { DecreeType } from "@/lib/chaos/catalog"
import type { BoardAssignment } from "@/lib/chaos/types"
import { isSalaxe } from "@/lib/lore/salaxe"
import { decreeCost, exileImmune, type CombinedEffects, type EffectNote } from "@/lib/titles/effects"
import type { Side } from "@/lib/types"

// Title effects on Royal Decrees, shared by the board, the dialog and the pre-migration fallback.
// Mirrors vvv_title_decree_cost() in supabase/phase10_title-effects.sql.

export interface DecreeTitles {
  actor: CombinedEffects
  ofPlayer: (playerId: string) => CombinedEffects
}

export interface DecreeAim {
  first?: string | null
  second?: string | null
  team?: Side | null
}

// The seats a decree is aimed at, the caster excluded: the chosen players, the teammate of a usurped seat, or a whole
// team. Wagers, pardons and makeovers aim at nobody.
export function decreeAimedSeats(
  type: DecreeType,
  aim: DecreeAim,
  assignments: readonly BoardAssignment[],
  actorPlayerId: string | null
): BoardAssignment[] {
  let ids: (string | null | undefined)[]
  switch (type) {
    case "champion_ban":
    case "lane_force":
      ids = [aim.first, aim.second]
      break
    case "swap_teammate":
      ids = [aim.first]
      break
    case "shuffle_lanes":
    case "reroll_champs":
      ids = aim.team ? assignments.filter((a) => a.side === aim.team).map((a) => a.player_id) : []
      break
    default:
      ids = []
  }
  return assignments.filter((a) => ids.includes(a.player_id) && a.player_id !== actorPlayerId)
}

export interface DecreePrice {
  cost: number
  pct: number
  notes: EffectNote[]
}

export function decreePrice(
  type: DecreeType,
  base: number,
  titles: DecreeTitles,
  aimed: readonly BoardAssignment[],
  actorIsSalaxe: boolean
): DecreePrice {
  const result = decreeCost({
    base,
    wager: type === "double_or_nothing",
    actor: titles.actor,
    aimsAtSalaxe: aimed.some((a) => isSalaxe(a.name)),
    actorIsSalaxe,
    targets: aimed.map((a) => ({ name: a.name, fx: titles.ofPlayer(a.player_id) })),
  })
  return { cost: result.value, pct: result.pct, notes: result.notes }
}

export function seatExileImmune(seat: BoardAssignment, titles: DecreeTitles | undefined): boolean {
  return !!titles && exileImmune(titles.ofPlayer(seat.player_id))
}
