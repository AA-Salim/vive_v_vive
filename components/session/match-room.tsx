"use client"

import { useState } from "react"
import { MotionConfig } from "motion/react"
import { toast } from "sonner"
import { CoachSelectDialog } from "@/components/coach-select-dialog"
import { RewardClaimBanner } from "@/components/reward-claim-banner"
import { GameRoom, type RoomViewer } from "@/components/session/game-room"
import { Lobby } from "@/components/session/lobby"
import { RoomError, RoomSkeleton } from "@/components/session/room-states"
import { phaseOf } from "@/components/session/copy"
import { useActiveSessionFailed, useDismissedResult } from "@/components/session/use-browser-state"
import { useCreateSession, useStartCoachDraft } from "@/components/session/use-session-actions"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { isActiveStatus } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import type { Player } from "@/lib/types"

export function MatchRoom() {
  const { session: activeSession, isLoading, refetch, serverTimeDelta } = useSession()
  const failed = useActiveSessionFailed()
  const { user, profile, isAdmin, signIn } = useAuth()
  const [dismissedId, setDismissedId] = useDismissedResult()
  const [coachDialogOpen, setCoachDialogOpen] = useState(false)
  const create = useCreateSession(signIn)
  const coachDraft = useStartCoachDraft(signIn)

  const session = activeSession as RoomSession | null
  const phase = phaseOf(session?.status)
  const viewer: RoomViewer = {
    userId: user?.id ?? null,
    playerId: profile?.player_id ?? null,
    isAdmin,
    signedIn: !!user,
    canControl: !!user && !!session && (isAdmin || !session.created_by || session.created_by === user.id),
  }

  const handleRandomize = (players: Player[]) => {
    if (!user) {
      toast("Sign in with Discord to start a game.", { action: { label: "Sign in", onClick: signIn } })
      return
    }
    if (players.length !== 10) {
      toast.error("Pick exactly ten players.")
      return
    }
    setDismissedId(null)
    create.mutate(players.map((p) => p.id))
  }

  const handleCoachDraft = (blue: string, red: string) => {
    setDismissedId(null)
    coachDraft.mutate({ blue, red })
  }

  let content
  if (isLoading) {
    content = <RoomSkeleton />
  } else if (failed && !session) {
    content = <RoomError onRetry={refetch} />
  } else if (session && phase !== "lobby" && (isActiveStatus(session.status) || dismissedId !== session.id)) {
    content = (
      <GameRoom
        session={session}
        phase={phase}
        serverTimeDelta={serverTimeDelta}
        viewer={viewer}
        onSignIn={signIn}
        onExpired={refetch}
        onDismissResult={() => setDismissedId(session.id)}
        onNextGame={refetch}
      />
    )
  } else {
    content = (
      <Lobby
        recent={session}
        dismissedId={dismissedId}
        serverTimeDelta={serverTimeDelta}
        viewer={viewer}
        busy={create.isPending || coachDraft.isPending}
        onSignIn={signIn}
        onRandomize={handleRandomize}
        onCoachDraft={() => setCoachDialogOpen(true)}
        onViewResult={() => setDismissedId(null)}
        onDismissNotice={(id) => setDismissedId(id)}
        onNextGame={refetch}
      />
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-5">
        <RewardClaimBanner />
        {content}
        <CoachSelectDialog
          open={coachDialogOpen}
          onOpenChange={setCoachDialogOpen}
          currentUserId={viewer.userId}
          onConfirm={handleCoachDraft}
        />
      </div>
    </MotionConfig>
  )
}
