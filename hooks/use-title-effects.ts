"use client"

import { useCallback, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { combineEffects, loadoutSources, NO_EFFECTS, type CombinedEffects, type EffectSource } from "@/lib/titles/effects"
import type { EquippedTitle } from "@/lib/titles/types"

// The live sources of one user, as served by GET /api/titles/equipped: equipped self titles and burning brands.
export function effectSourcesOfEquipped(entry: EquippedTitle | null | undefined): EffectSource[] {
  return loadoutSources(entry)
}

export function effectsOfEquipped(entry: EquippedTitle | null | undefined): CombinedEffects {
  const sources = loadoutSources(entry)
  return sources.length ? combineEffects(sources) : NO_EFFECTS
}

// The signed-in user's combined immediate effects. Values come from lib/titles/effects.ts, never retyped.
export function useMyTitleEffects() {
  const { user } = useAuth()
  const { byUserId } = useEquippedTitles()
  const entry = user ? (byUserId.get(user.id) ?? null) : null
  return useMemo(() => ({ entry, fx: effectsOfEquipped(entry) }), [entry])
}

// Anyone's effects, for decrees and bets that read the target's titles (Royal Carpet, exile immunity).
export function useTitleEffectsLookup() {
  const { byPlayerId, byUserId } = useEquippedTitles()
  const ofPlayer = useCallback((playerId: string | null | undefined) => effectsOfEquipped(playerId ? byPlayerId.get(playerId) : null), [byPlayerId])
  const ofUser = useCallback((userId: string | null | undefined) => effectsOfEquipped(userId ? byUserId.get(userId) : null), [byUserId])
  return { ofPlayer, ofUser, byPlayerId, byUserId }
}
