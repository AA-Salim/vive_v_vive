"use client"

import { useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { betTitleTerms, type BetTitleTerms } from "@/lib/betting/title-terms"
import { isSalaxe } from "@/lib/lore/salaxe"
import type { CombinedEffects } from "@/lib/titles/effects"
import type { Side } from "@/lib/types"

export interface BetTerms {
  terms: BetTitleTerms
  fx: CombinedEffects
  salaxeSide: Side | null
}

// The viewer's title terms on this game's bets: Salaxe's side comes from the live session's seats.
export function useBetTerms(sessionId: string): BetTerms {
  const { fx } = useMyTitleEffects()
  const { profile } = useAuth()
  const { session } = useSession()
  const salaxeSide =
    session && session.id === sessionId
      ? (session.session_assignments.find((a) => isSalaxe(a.players?.name))?.side ?? null)
      : null
  const viewerIsSalaxe = isSalaxe(profile?.players?.name)
  return useMemo(
    () => ({ terms: betTitleTerms(fx, { salaxeSide, isSalaxe: viewerIsSalaxe }), fx, salaxeSide }),
    [fx, salaxeSide, viewerIsSalaxe]
  )
}
