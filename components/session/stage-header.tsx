"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlertTriangleIcon, LogInIcon, RadioTowerIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { SessionControls } from "@/components/session-controls"
import { PhaseStepper } from "@/components/session/phase-stepper"
import { GameClock, PhaseTimer } from "@/components/session/phase-timer"
import { useServerNow } from "@/components/session/use-clock"
import { PHASE_COPY, relativeTime, waitingLine, type RoomPhase } from "@/components/session/copy"
import { BET_WINDOW_HELP, PHASE_HELP } from "@/components/session/help"
import { DECREE_WINDOW_HELP } from "@/components/chaos/help"
import { STALE_CLAIM_MS, STALE_GAME_MS, phaseDurationMs, phaseEndsAt } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import { cn } from "@/lib/utils"

interface StageHeaderProps {
  session: RoomSession | null
  phase: RoomPhase
  serverTimeDelta: number
  canControl: boolean
  isAdmin: boolean
  signedIn: boolean
  onSignIn: () => void
  onExpired: () => void
  children?: ReactNode
}

const MODE_LABEL: Record<string, string> = {
  standard: "Random draft",
  coach_draft: "Coach draft",
  vainqueur: "Vainqueur rotation",
}

export function StageHeader({
  session,
  phase,
  serverTimeDelta,
  canControl,
  isAdmin,
  signedIn,
  onSignIn,
  onExpired,
  children,
}: StageHeaderProps) {
  const serverNow = useServerNow(serverTimeDelta, 1000)
  const copy = PHASE_COPY[phase]
  const endsAt = session ? phaseEndsAt(session) : null
  const duration = session ? phaseDurationMs(session.status) : null
  const host = session?.creator?.name ?? "the host"
  const claimAge = session?.resolved_by && serverNow !== null ? serverNow - Date.parse(session.updated_at) : null
  const resolving =
    session?.status === "in_game" && claimAge !== null && claimAge < STALE_CLAIM_MS ? session.resolver?.name ?? "The host" : null
  const startedAt = session ? Date.parse(session.created_at) : null
  const staleGame =
    session?.status === "in_game" && serverNow !== null && startedAt !== null && serverNow - startedAt > STALE_GAME_MS
  const waiting = session && !canControl ? waitingLine(phase, host, resolving) : null
  const staleSince = staleGame && canControl && startedAt !== null ? new Date(startedAt).toLocaleString() : null

  const liveSince =
    session?.status === "in_game"
      ? Math.min(...[session.betting_ends_at, session.updated_at].map((v) => (v ? Date.parse(v) : Infinity)))
      : null
  const showClock = liveSince !== null && Number.isFinite(liveSince) && !staleGame && !resolving

  const timer =
    session && endsAt !== null && duration !== null ? (
      <PhaseTimer
        key={`${session.id}:${session.status}`}
        endsAt={endsAt}
        durationMs={duration}
        serverTimeDelta={serverTimeDelta}
        label={session.status === "chaos" ? "Decrees close in" : "Bets lock in"}
        help={session.status === "chaos" ? DECREE_WINDOW_HELP : BET_WINDOW_HELP}
        onExpired={onExpired}
        className="lg:items-end lg:text-right"
      />
    ) : showClock && liveSince !== null ? (
      <GameClock since={liveSince} serverTimeDelta={serverTimeDelta} className="lg:items-end lg:text-right" />
    ) : null
  const controls =
    session && canControl ? (
      <SessionControls session={session} canControl={canControl} isAdmin={isAdmin} serverNow={serverNow} onSignIn={onSignIn} />
    ) : null
  const inlineControls = !!controls && !timer && !waiting && !staleSince && !children && signedIn
  const hasFooter = (!!controls && !inlineControls) || !!waiting || !!staleSince || !!children || !signedIn

  return (
    <section
      aria-labelledby="stage-title"
      className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card shadow-2xl shadow-black/40"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/80 to-transparent" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-28 left-1/2 h-56 w-[40rem] max-w-[140%] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700",
          phase === "chaos" ? "bg-[var(--color-red-team)]/10" : phase === "in_game" ? "bg-[var(--color-blue-team)]/10" : "bg-[var(--color-gold)]/10"
        )}
      />
      <div className="relative flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {phase === "lobby" ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/60" />
              No game running
            </span>
          ) : (
            <PhaseStepper phase={phase} coachMode={session?.game_mode === "coach_draft"} />
          )}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-gold)]/90">
              {session ? (
                <>
                  <span className="hidden sm:inline">{MODE_LABEL[session.game_mode] ?? "Custom game"} · </span>
                  {session.creator ? `Hosted by ${session.creator.name}` : "Open game"}
                  {serverNow !== null && startedAt !== null ? ` · ${relativeTime(startedAt, serverNow)}` : ""}
                </>
              ) : (
                "Vive v Vive"
              )}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={phase}
                id="stage-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 font-display text-3xl leading-tight font-semibold text-foreground sm:text-4xl"
              >
                {copy.title}
                <InfoTip help={PHASE_HELP[phase]} side="bottom" align="start" />
              </motion.h1>
            </AnimatePresence>
            <p className={cn("max-w-xl text-sm text-muted-foreground", timer && "hidden sm:block")}>{copy.line}</p>
          </div>
          {timer ?? (inlineControls && <div className="flex shrink-0 flex-col gap-2 lg:items-end">{controls}</div>)}
        </div>

        {hasFooter && (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 empty:hidden">
              {!inlineControls && controls}
              {waiting && (
                <p className="flex items-center gap-2 text-sm text-[var(--color-gold-light)]/85" role="status">
                  <RadioTowerIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
                  {waiting}
                </p>
              )}
              {staleSince && (
                <p className="flex items-start gap-2 text-sm text-[var(--color-gold-light)]/85">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
                  This game has been live since {staleSince}. Declare a winner or cancel it to free the Rift.
                </p>
              )}
              {children}
            </div>
            {!signedIn && (
              <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={onSignIn}>
                <LogInIcon aria-hidden />
                Sign in to play along
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
