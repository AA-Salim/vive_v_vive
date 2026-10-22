import { combineEffects, type CombinedEffects, type EffectSource } from "@/lib/titles/effects"
import { isExpired } from "@/lib/titles/expiry"
import { LOADOUT_SLOTS, equipBlock, loadoutSlotOf, primaryOf, type LoadoutItem, type LoadoutSlot } from "@/lib/titles/loadout"
import { setProgress, type SetProgress } from "@/lib/titles/sets"
import type { OwnedTitleView, TitlesCatalogResponse, TitleView } from "@/lib/titles/types"

export interface WornTitle extends LoadoutItem {
  title: TitleView
  owned: OwnedTitleView
  slot: LoadoutSlot
  primary: boolean
}

export interface LoadoutModel {
  // False before the loadout migration: one title at a time, equipping replaces it.
  enabled: boolean
  locked: boolean
  worn: WornTitle[]
  bySlot: Record<LoadoutSlot, WornTitle[]>
  activeIds: string[]
  fx: CombinedEffects
  // How far the loadout is into every set bonus (empty before sets exist).
  sets: SetProgress[]
  isWorn: (titleId: string) => boolean
  // Why this title cannot join the loadout right now, or null.
  blockFor: (title: TitleView) => string | null
  // Same, once the title is bought or renewed: slots and conflicts only.
  fitFor: (title: TitleView) => string | null
  idsWith: (title: TitleView) => string[]
  idsWithout: (title: TitleView) => string[]
}

const itemOf = (title: TitleView): LoadoutItem => ({ name: title.name, category: title.category, tier: title.tier })

export function buildLoadout(catalog: TitlesCatalogResponse | undefined): LoadoutModel {
  const titleById = new Map((catalog?.titles ?? []).map((t) => [t.id, t]))
  const enabled = catalog?.loadouts ?? false
  const locked = catalog?.locked ?? false

  const rows = (catalog?.collection ?? []).flatMap((owned) => {
    const title = titleById.get(owned.title_id)
    return title && owned.is_active && !isExpired(owned.games_left)
      ? [{ title, owned, ...itemOf(title), equippedAt: owned.equipped_at ?? null }]
      : []
  })
  const primary = primaryOf(rows)
  const worn: WornTitle[] = [...rows]
    .sort((a, b) => Number(b === primary) - Number(a === primary))
    .map((row) => ({ ...row, slot: loadoutSlotOf(row), primary: row === primary }))

  const bySlot = Object.fromEntries(LOADOUT_SLOTS.map((slot) => [slot, worn.filter((w) => w.slot === slot)])) as Record<
    LoadoutSlot,
    WornTitle[]
  >
  const activeIds = worn.map((w) => w.title.id)
  const active = new Set(activeIds)

  const sources: EffectSource[] = [
    ...worn.filter((w) => w.title.for_self).map((w) => ({ title: w.title.name, kind: "equipped" as const })),
    ...(catalog?.collection ?? []).flatMap((owned) => {
      const title = titleById.get(owned.title_id)
      return title && owned.curse?.active ? [{ title: title.name, kind: "curse" as const }] : []
    }),
  ]

  const ownedById = new Map((catalog?.collection ?? []).map((owned) => [owned.title_id, owned]))

  return {
    enabled,
    locked,
    worn,
    bySlot,
    activeIds,
    fx: combineEffects(sources),
    sets: setProgress(worn.filter((w) => w.title.for_self).map((w) => w.title.name)),
    isWorn: (titleId) => active.has(titleId),
    blockFor: (title) => {
      if (locked) return "Titles are sealed while a game is live."
      if (isExpired(ownedById.get(title.id)?.games_left)) return "Out of games: renew it to wear it again."
      if (!enabled || active.has(title.id)) return null
      return equipBlock(worn, itemOf(title))?.message ?? null
    },
    fitFor: (title) => {
      if (locked) return "Titles are sealed while a game is live."
      if (!enabled || active.has(title.id)) return null
      return equipBlock(worn, itemOf(title))?.message ?? null
    },
    idsWith: (title) => (enabled ? [...activeIds.filter((id) => id !== title.id), title.id] : [title.id]),
    idsWithout: (title) => activeIds.filter((id) => id !== title.id),
  }
}
