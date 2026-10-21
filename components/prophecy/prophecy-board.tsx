"use client"

import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { CoinsIcon, LogInIcon, ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { AnimatedNumber } from "@/components/prophecy/animated-number"
import { MarketOutcome } from "@/components/prophecy/market-outcome"
import { MarketSwitch } from "@/components/prophecy/market-switch"
import { ComingSoon, PanelError, PanelShell, PanelSkeleton } from "@/components/prophecy/panel-states"
import { ProphecyBuilder } from "@/components/prophecy/prophecy-builder"
import { ProphecyLedger } from "@/components/prophecy/prophecy-ledger"
import { useProphecyBoard, useSealProphecy, type ClockedBoard, type SealInput } from "@/components/prophecy/queries"
import { RulesPopover } from "@/components/prophecy/rules-popover"
import { SealedProphecy } from "@/components/prophecy/sealed-prophecy"
import { sealLabel } from "@/lib/prophecy/lines"
import { totalPot } from "@/lib/prophecy/odds"

type Phase = "soon" | "open" | "locked" | "voting" | "settled" | "adjourned" | "canceled"

const TITLE = "Prophecies"

const SUBTITLES: Record<Phase, string> = {
  soon: "Prophecies open with the Royal Decrees. Start thinking about who carries and who feeds.",
  open: "Call the MVP or the Inter. When the Nexus falls, the court votes and whoever called it splits the pot.",
  locked: "Prophecies are sealed. The court votes when the Nexus falls.",
  voting: "The tribunal is voting. Your fate is in their hands.",
  settled: "The tribunal has spoken. The Oracle pays its debts.",
  adjourned: "No tribunal sat for this game. Every stake went home.",
  canceled: "Game canceled. Every stake went home.",
}

const EMPTY: Record<Phase, string> = {
  soon: "The Oracle opens its ledger once the draft is final.",
  open: "No prophecies yet. The first prophet sets the tone.",
  locked: "Nobody sealed a prophecy this game. The Oracle took the day off.",
  voting: "No prophecies this game. The court votes for honor alone.",
  settled: "No prophecies this game. The court voted for honor alone.",
  adjourned: "No prophecies this game.",
  canceled: "No prophecies were sealed.",
}

function phaseOf(board: ClockedBoard, sealingAllowed: boolean): Phase {
  const status = board.sessionStatus
  if (status === "canceled" || status === "expired") return "canceled"
  if (status === "draft" || status === "coach_draft") return "soon"
  if (status === "blue_win" || status === "red_win") {
    if (board.tribunal) return board.tribunal.status === "settled" ? "settled" : "voting"
    return board.wagers.some((w) => w.status === "pending") ? "voting" : "adjourned"
  }
  return board.open && sealingAllowed ? "open" : "locked"
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2 },
}

export function ProphecyBoardView({ sessionId, sealingAllowed }: { sessionId: string; sealingAllowed: boolean }) {
  const query = useProphecyBoard(sessionId)
  const seal = useSealProphecy(sessionId)
  const { signIn } = useAuth()
  const board = query.data
  const points = usePoints(board?.viewer?.userId ?? null)

  if (query.isPending) return <PanelSkeleton icon={ScrollTextIcon} title={TITLE} />
  if (!board) {
    return (
      <PanelError
        icon={ScrollTextIcon}
        title={TITLE}
        message="The Oracle is unreachable. Its crystal ball is buffering."
        onRetry={() => query.refetch()}
      />
    )
  }

  if (!board.enabled) {
    return (
      <ComingSoon icon={ScrollTextIcon} title={TITLE}>
        <p>
          MVP and Inter prophecies unlock once the royal scribes finish the paperwork. Lane Calls are retired: the lanes
          were visible during betting, everyone hit, and the treasury wept.
        </p>
        {board.legacy.length > 0 && (
          <div className="mt-3">
            <ProphecyLedger
              wagers={[]}
              legacy={board.legacy}
              candidates={board.candidates}
              viewerId={board.viewer?.userId ?? null}
            />
          </div>
        )}
      </ComingSoon>
    )
  }

  const handleSeal = (input: SealInput) => {
    const name = board.candidates.find((c) => c.playerId === input.playerId)?.name ?? "Someone"
    seal.mutate(input, {
      onSuccess: () => {
        toast.success("Sealed in royal wax", { description: `${sealLabel(input.market, name)} · ${input.stake} points` })
        points.refetch()
      },
    })
  }

  const phase = phaseOf(board, sealingAllowed)
  const mine = board.mine
  const mineCandidate = mine?.playerId ? board.candidates.find((c) => c.playerId === mine.playerId) ?? null : null
  const building = phase === "open" && !!board.viewer && !mine
  const sealedPhase =
    phase === "open" || phase === "voting" ? phase : phase === "locked" || phase === "soon" ? "locked" : "settled"
  const pot = totalPot(board.books)

  return (
    <MotionConfig reducedMotion="user">
      <PanelShell
        icon={ScrollTextIcon}
        title={TITLE}
        subtitle={SUBTITLES[phase]}
        aside={
          <div className="flex items-center gap-1">
            <span className="flex h-8 items-center gap-1 rounded-full bg-[var(--color-gold)]/10 px-2.5 text-xs font-semibold text-[var(--color-gold)]">
              <CoinsIcon className="size-3.5" aria-hidden />
              <span className="sr-only">Total pot</span>
              <AnimatedNumber value={pot} />
            </span>
            <RulesPopover />
          </div>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {building && (
            <motion.div key="builder" {...fade}>
              <ProphecyBuilder
                board={board}
                balance={points.isLoading ? null : points.balance}
                sealing={seal.isPending}
                onSeal={handleSeal}
              />
            </motion.div>
          )}
          {mine && (
            <motion.div key="sealed" {...fade}>
              <SealedProphecy wager={mine} candidate={mineCandidate} book={board.books[mine.market]} phase={sealedPhase} />
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "open" && !board.viewer && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">Log in with Discord to seal a prophecy.</p>
            <Button onClick={signIn} variant="outline" className="h-10 gap-1.5 px-4">
              <LogInIcon className="size-4" aria-hidden />
              Log in to prophesy
            </Button>
          </div>
        )}

        {phase === "settled" && board.tribunal?.summary ? (
          <MarketOutcome summary={board.tribunal.summary} />
        ) : (
          !building && <MarketSwitch books={board.books} candidates={board.candidates} />
        )}

        {board.wagers.length === 0 && !building && (
          <p className="px-1 text-center text-xs text-muted-foreground">{EMPTY[phase]}</p>
        )}

        <ProphecyLedger
          wagers={board.wagers}
          legacy={board.legacy}
          candidates={board.candidates}
          viewerId={board.viewer?.userId ?? null}
        />
      </PanelShell>
    </MotionConfig>
  )
}
