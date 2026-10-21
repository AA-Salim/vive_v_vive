"use client"

import { UsersIcon } from "lucide-react"
import { Chronicle } from "@/components/chronicle"
import { RosterManager } from "@/components/roster-manager"
import { Court } from "@/components/session/court"
import { LastGameNotice } from "@/components/session/last-game-notice"
import { StageHeader } from "@/components/session/stage-header"
import { useMediaQuery } from "@/components/session/use-browser-state"
import type { RoomViewer } from "@/components/session/game-room"
import { winnerOf } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import type { Player } from "@/lib/types"

interface LobbyProps {
  recent: RoomSession | null
  dismissedId: string | null
  serverTimeDelta: number
  viewer: RoomViewer
  busy: boolean
  onSignIn: () => void
  onRandomize: (players: Player[]) => void
  onCoachDraft: () => void
  onViewResult: (sessionId: string) => void
  onDismissNotice: (sessionId: string) => void
  onNextGame: () => void
}

export function Lobby({
  recent,
  dismissedId,
  serverTimeDelta,
  viewer,
  busy,
  onSignIn,
  onRandomize,
  onCoachDraft,
  onViewResult,
  onDismissNotice,
  onNextGame,
}: LobbyProps) {
  const isXl = useMediaQuery("(min-width: 1280px)")
  const recentWinner = recent ? winnerOf(recent.status) : null

  const notice =
    recent && (recentWinner || dismissedId !== recent.id) ? (
      <LastGameNotice
        session={recent}
        serverTimeDelta={serverTimeDelta}
        onView={recentWinner ? () => onViewResult(recent.id) : undefined}
        onDismiss={recentWinner ? undefined : () => onDismissNotice(recent.id)}
      />
    ) : null

  const header = (
    <StageHeader
      session={null}
      phase="lobby"
      serverTimeDelta={serverTimeDelta}
      canControl={false}
      isAdmin={viewer.isAdmin}
      signedIn={viewer.signedIn}
      onSignIn={onSignIn}
      onExpired={() => {}}
    >
      {viewer.signedIn && (
        <p className="flex items-center gap-2 text-sm text-[var(--color-gold-light)]/85">
          <UsersIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
          Pick ten players in the roster and roll. Everyone watches the draw live.
        </p>
      )}
    </StageHeader>
  )

  const roster = (
    <section id="roster" aria-label="Roster" className="scroll-mt-4">
      <RosterManager onRandomize={onRandomize} onCoachDraft={onCoachDraft} isAdmin={viewer.isAdmin} disabled={busy} />
    </section>
  )

  const court = (
    <Court userId={viewer.userId} playerId={viewer.playerId} isAdmin={viewer.isAdmin} sessionResolved onNextGame={onNextGame} />
  )

  if (isXl) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6">
            {notice}
            {roster}
            <Chronicle />
          </div>
          <aside aria-label="The Court" className="flex flex-col gap-4">
            {court}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {notice}
      {roster}
      <Chronicle />
      {court}
    </div>
  )
}
