"use client"

import { useMemo, useState } from "react"
import { MotionConfig } from "motion/react"
import { LockedView, OpenView, ResultView, groupDuels, type ActionState } from "@/components/duels/board-views"
import { ChallengeSheet } from "@/components/duels/challenge-sheet"
import { DuelComingSoon, DuelError, DuelSkeleton } from "@/components/duels/duel-shell"
import { useDuelFallbackAlerts } from "@/components/duels/use-duel-alerts"
import { useDeadlinePassed, useDuelHighlights } from "@/components/duels/use-duel-live"
import { useDuelAction, usePendingDuelActions } from "@/components/duels/use-duel-mutations"
import { useDuelBoard, usePrefetchDuelRoster } from "@/components/duels/use-duels"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { rivalsOf } from "@/lib/duels/eligibility"
import type { Duelist } from "@/lib/duels/types"
import type { SessionStatus, SessionWithAssignments } from "@/lib/types"

type Mode = "open" | "locked" | "result"

function modeOf(status: SessionStatus): Mode | null {
  switch (status) {
    case "draft":
    case "chaos":
    case "betting":
      return "open"
    case "in_game":
      return "locked"
    case "blue_win":
    case "red_win":
      return "result"
    default:
      return null
  }
}

// Trials by combat: 1v1 wagers on the current game. Full board while challenges are open, compact read-only
// cards during the game, verdicts on the result screen (nothing at all when no duel was fought).
export function DuelsPanel({ session }: { session: SessionWithAssignments }) {
  const mode = modeOf(session.status)
  if (!mode) return null
  return (
    <MotionConfig reducedMotion="user">
      <DuelsBoard session={session} baseMode={mode} />
    </MotionConfig>
  )
}

function DuelsBoard({ session, baseMode }: { session: SessionWithAssignments; baseMode: Mode }) {
  const { user, profile, signIn, isLoading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const points = usePoints(userId)
  const query = useDuelBoard(session.id, session.status)
  const highlights = useDuelHighlights(session.id)
  useDuelFallbackAlerts(userId)
  const action = useDuelAction(session.id, session.status, userId ?? "anonymous")
  const pending = usePendingDuelActions(session.id)
  // Bound to the game it was opened for: the panel stays mounted into the next game's draft.
  const [sheetFor, setSheetFor] = useState<string | null>(null)

  const board = query.data && query.data.session.id === session.id ? query.data : undefined
  const clockOffset = board?.clockOffset ?? 0
  const endsAt = session.status === "betting" && session.betting_ends_at ? Date.parse(session.betting_ends_at) : Number.NaN
  const deadlinePassed = useDeadlinePassed(Number.isNaN(endsAt) ? null : endsAt + clockOffset)
  const serverClosed = board?.session.status === session.status && board.session.accepting === false
  const gatesOpen = baseMode === "open" && !deadlinePassed && !serverClosed
  const mode: Mode = baseMode === "open" && !gatesOpen ? "locked" : baseMode
  usePrefetchDuelRoster(gatesOpen && !!userId && !!board?.enabled)

  const duels = useMemo(() => board?.duels ?? [], [board])
  const groups = useMemo(() => groupDuels(duels, userId), [duels, userId])
  const rivals = useMemo(() => rivalsOf(duels, userId), [duels, userId])

  const me: Duelist | null = userId
    ? {
        userId,
        name: profile?.players?.name ?? profile?.discord_username ?? "You",
        avatarUrl: profile?.discord_avatar_url ?? null,
        playerId: profile?.player_id ?? null,
      }
    : null
  const balance = userId && !points.isLoading ? points.balance : null

  if (!board) {
    if (query.isError) return mode === "open" ? <DuelError onRetry={() => query.refetch()} retrying={query.isFetching} /> : null
    return mode === "open" ? <DuelSkeleton /> : null
  }
  if (!board.enabled) return mode === "open" ? <DuelComingSoon /> : null

  const actions: ActionState = {
    viewer: { userId, side: board.viewer?.side ?? null, balance },
    rivals,
    pendingFor: (duel) => pending.get(duel.id) ?? null,
    onAction: (duel, act) => {
      if (!me) {
        signIn()
        return
      }
      action.mutate({ duel, action: act, me })
    },
    onSignIn: () => signIn(),
  }

  if (mode === "result") return <ResultView groups={groups} viewerId={userId} highlights={highlights} />
  if (mode === "locked") return <LockedView groups={groups} viewerId={userId} highlights={highlights} />

  return (
    <>
      <OpenView
        groups={groups}
        all={duels}
        highlights={highlights}
        actions={actions}
        signedIn={!!me}
        authLoading={authLoading}
        gatesOpen={gatesOpen}
        onChallenge={() => setSheetFor(session.id)}
      />
      {me && (
        <ChallengeSheet
          open={sheetFor === session.id && gatesOpen}
          onOpenChange={(open) => setSheetFor(open ? session.id : null)}
          session={session}
          duels={duels}
          me={me}
          mySide={board.viewer?.side ?? null}
          balance={balance}
          gatesOpen={gatesOpen}
        />
      )}
    </>
  )
}
