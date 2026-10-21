"use client"

import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { GavelIcon, LoaderCircleIcon } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { BallotBox } from "@/components/prophecy/ballot-box"
import { CountdownChip, TimeBar } from "@/components/prophecy/countdown-chip"
import { ComingSoon, PanelError, PanelShell, PanelSkeleton } from "@/components/prophecy/panel-states"
import { useTribunal } from "@/components/prophecy/queries"
import { useNow } from "@/components/prophecy/use-now"
import { useSettleWhenDue } from "@/components/prophecy/use-settle-when-due"
import { Verdict } from "@/components/prophecy/verdict"
import { VOTE_WINDOW_MS } from "@/lib/prophecy/constants"

const TITLE = "The Tribunal"

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
}

export function Tribunal({ sessionId }: { sessionId: string }) {
  const query = useTribunal(sessionId)
  const { signIn } = useAuth()
  const now = useNow()
  const state = query.data
  const vote = state?.vote ?? null
  const closesAt = vote ? Date.parse(vote.closesAt) : null
  const settled = vote?.status === "settled"
  useSettleWhenDue(closesAt, settled, state?.clockOffset ?? 0, query.refetch)

  if (query.isPending) return <PanelSkeleton icon={GavelIcon} title={TITLE} />
  if (!state) {
    return (
      <PanelError
        icon={GavelIcon}
        title={TITLE}
        message="The tribunal could not be reached. The bailiff is looking for the keys."
        onRetry={() => query.refetch()}
      />
    )
  }
  if (!state.enabled) {
    return (
      <ComingSoon icon={GavelIcon} title={TITLE}>
        After every game the court will crown an MVP and roast an Inter, and settle the prophecies riding on them.
        The bailiff is still nailing the benches together.
      </ComingSoon>
    )
  }
  if (!vote) return null

  const serverNow = now - state.clockOffset
  const msLeft = closesAt !== null && now > 0 ? Math.max(0, closesAt - serverNow) : VOTE_WINDOW_MS
  const windowMs = closesAt !== null ? Math.max(1, closesAt - Date.parse(vote.openedAt)) : VOTE_WINDOW_MS
  const phase = settled ? "settled" : msLeft > 0 ? "open" : "counting"
  const atStake = state.pots.mvp + state.pots.inter

  const subtitle =
    phase === "settled"
      ? "The tribunal has spoken. Appeals may be filed with Salaxe, who will ignore them."
      : phase === "counting"
        ? "The gavel falls. Counting ballots..."
        : `Crown the MVP. Name the Inter. You cannot vote for yourself.${atStake > 0 ? ` ${atStake} points of prophecies hang on this verdict.` : ""}`

  return (
    <MotionConfig reducedMotion="user">
      <PanelShell
        icon={GavelIcon}
        title={TITLE}
        subtitle={subtitle}
        aside={
          phase === "open" ? (
            <CountdownChip msLeft={msLeft} />
          ) : phase === "counting" ? (
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground">
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
              Counting
            </span>
          ) : null
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {phase === "settled" && vote.summary ? (
            <motion.div key="verdict" {...fade}>
              <Verdict state={state} summary={vote.summary} />
            </motion.div>
          ) : phase === "counting" || phase === "settled" ? (
            <motion.div key="counting" {...fade} className="flex flex-col items-center gap-3 py-8 text-center">
              <GavelIcon className="size-10 text-[var(--color-gold)] motion-safe:animate-bounce" aria-hidden />
              <p className="font-display text-lg text-foreground">Order in the court.</p>
              <p className="text-xs text-muted-foreground">The bailiff is counting ballots and paying the prophets.</p>
            </motion.div>
          ) : (
            <motion.div key="ballot" {...fade} className="space-y-3">
              <TimeBar msLeft={msLeft} totalMs={windowMs} />
              <BallotBox state={state} onSignIn={signIn} />
            </motion.div>
          )}
        </AnimatePresence>
      </PanelShell>
    </MotionConfig>
  )
}
