"use client"

import { CoachDraftPanel } from "@/components/coach-draft-panel"
import { ChampionPickPanel } from "@/components/lobby/champion-pick/champion-pick-panel"
import { championSelectOpen, type ChampionSelectColumns } from "@/lib/lobby/champion-pick"
import type { GameSession } from "@/lib/types"

// The coach draft room: players and lanes first, then (once the teams are locked) champion select.
export function CoachDraftStage({ session, userId }: { session: GameSession; userId: string | null }) {
  if (championSelectOpen(session as GameSession & ChampionSelectColumns)) {
    return <ChampionPickPanel key={session.id} session={session} userId={userId} />
  }
  return <CoachDraftPanel session={session} userId={userId} />
}
