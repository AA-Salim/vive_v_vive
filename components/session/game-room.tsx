"use client"

import type { ReactNode } from "react"
import { ActivityFeed } from "@/components/live/activity-feed"
import { BettingPanel } from "@/components/betting-panel"
import { ChaosPanel } from "@/components/chaos-panel"
import { CoachDraftPanel } from "@/components/coach-draft-panel"
import { DuelsPanel } from "@/components/duels-panel"
import { PostGameVote } from "@/components/post-game-vote"
import { ProphecyPanel } from "@/components/prophecy-panel"
import { Court } from "@/components/session/court"
import { MatchBoard } from "@/components/session/match-board"
import { ResultScreen } from "@/components/session/result-screen"
import { StageHeader } from "@/components/session/stage-header"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { useLockToggle } from "@/components/session/use-session-actions"
import type { RoomPhase } from "@/components/session/copy"
import type { RoomSession } from "@/lib/session/types"

export interface RoomViewer {
  userId: string | null
  playerId: string | null
  isAdmin: boolean
  signedIn: boolean
  canControl: boolean
}

interface GameRoomProps {
  session: RoomSession
  phase: Exclude<RoomPhase, "lobby">
  serverTimeDelta: number
  viewer: RoomViewer
  onSignIn: () => void
  onExpired: () => void
  onDismissResult: () => void
  onNextGame: () => void
}

function primaryPanel(phase: GameRoomProps["phase"], session: RoomSession, userId: string | null): ReactNode {
  switch (phase) {
    case "coach_draft":
      return <CoachDraftPanel session={session} userId={userId} />
    case "chaos":
      return <ChaosPanel session={session} isOpen />
    case "betting":
      return <BettingPanel sessionId={session.id} isBettingOpen />
    case "in_game":
      return <BettingPanel sessionId={session.id} isBettingOpen={false} />
    case "result":
      return <PostGameVote session={session} />
    default:
      return null
  }
}

function secondaryPanels(phase: GameRoomProps["phase"], session: RoomSession): ReactNode[] {
  switch (phase) {
    case "draft":
    case "chaos":
      return [<DuelsPanel key="duels" session={session} />]
    case "betting":
      return [
        <ProphecyPanel key="prophecy" session={session} isBettingOpen />,
        <DuelsPanel key="duels" session={session} />,
        <ChaosPanel key="chaos" session={session} isOpen={false} />,
      ]
    case "in_game":
      return [
        <ProphecyPanel key="prophecy" session={session} isBettingOpen={false} />,
        <DuelsPanel key="duels" session={session} />,
        <ChaosPanel key="chaos" session={session} isOpen={false} />,
      ]
    case "result":
      return [
        <BettingPanel key="bets" sessionId={session.id} isBettingOpen={false} />,
        <DuelsPanel key="duels" session={session} />,
        <ProphecyPanel key="prophecy" session={session} isBettingOpen={false} />,
      ]
    default:
      return []
  }
}

export function GameRoom({ session, phase, serverTimeDelta, viewer, onSignIn, onExpired, onDismissResult, onNextGame }: GameRoomProps) {
  const isXl = useMediaQuery("(min-width: 1280px)")
  const isMd = useMediaQuery("(min-width: 768px)")
  const { toggleLock, pendingLocks } = useLockToggle(session, onSignIn)

  const header =
    phase === "result" ? (
      <ResultScreen session={session} serverTimeDelta={serverTimeDelta} onDismiss={onDismissResult} />
    ) : (
      <StageHeader
        session={session}
        phase={phase}
        serverTimeDelta={serverTimeDelta}
        canControl={viewer.canControl}
        isAdmin={viewer.isAdmin}
        signedIn={viewer.signedIn}
        onSignIn={onSignIn}
        onExpired={onExpired}
      />
    )

  const board =
    phase === "coach_draft" || session.session_assignments.length === 0 ? null : (
      <MatchBoard
        session={session}
        serverTimeDelta={serverTimeDelta}
        meId={viewer.playerId}
        canLock={viewer.canControl}
        pendingLocks={pendingLocks}
        onToggleLock={toggleLock}
      />
    )

  const primary = primaryPanel(phase, session, viewer.userId)
  const primarySlot = primary ? (
    <div id="room-action" className="scroll-mt-4">
      {primary}
    </div>
  ) : null
  const secondary = secondaryPanels(phase, session)
  const feed = <ActivityFeed sessionId={session.id} />
  const courtProps = {
    userId: viewer.userId,
    playerId: viewer.playerId,
    isAdmin: viewer.isAdmin,
    sessionResolved: phase === "result",
    onNextGame,
  }

  if (isXl) {
    const mainLead = board ?? primarySlot
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6">
            {mainLead}
            {secondary.length > 0 && <div className="grid grid-cols-2 items-start gap-6">{secondary}</div>}
          </div>
          <aside
            aria-label="Your moves and the court"
            className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain pr-1 pb-2 [scrollbar-width:thin]"
          >
            {board && primarySlot}
            {feed}
            <Court {...courtProps} />
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {isMd ? (
        <>
          {board}
          {primarySlot}
        </>
      ) : (
        <>
          {primarySlot}
          {board}
        </>
      )}
      {secondary.length > 0 && <div className="grid items-start gap-5 md:grid-cols-2">{secondary}</div>}
      {feed}
      <Court collapsible {...courtProps} />
    </div>
  )
}
