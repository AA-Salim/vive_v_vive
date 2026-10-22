"use client"

import { useCallback, useId, useState } from "react"
import { motion } from "motion/react"
import { BrainIcon, RefreshCwIcon, XCircleIcon } from "lucide-react"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InfoTip } from "@/components/ui/info-tip"
import { RIDDLE_HELP } from "@/components/praise/help"
import { ArrowPuzzle } from "@/components/praise/riddle/arrow-puzzle"
import { MazePuzzle } from "@/components/praise/riddle/maze-puzzle"
import { AnswerToken } from "@/components/praise/riddle/riddle-outcome"
import { SequencePuzzle } from "@/components/praise/riddle/sequence-puzzle"
import { useSolveRiddle } from "@/hooks/use-praise"
import { explainRiddle, riddleAnswerLabel } from "@/lib/praise/riddle"
import { RIDDLE_FIRST_TRY_BONUS } from "@/lib/praise/rules"
import type { RetiredRiddle, RiddleAnswer, RiddleView } from "@/lib/praise/types"
import {
  RIDDLE_COPY,
  RIDDLE_INTROS,
  RIDDLE_MISS_LINES,
  RIDDLE_PROMPTS,
  RIDDLE_SKIP_LINES,
  seededPick,
} from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

interface Feedback {
  tone: "miss" | "skip" | "error"
  line: string
  previous: RetiredRiddle | null
}

function BonusChip({ bonus }: { bonus: number }) {
  const alive = bonus > 0
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        alive
          ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
          : "border-border text-muted-foreground line-through decoration-1"
      )}
    >
      {RIDDLE_COPY.bonusBadge}
      {!alive && <span className="sr-only"> (lost)</span>}
    </span>
  )
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const previous = feedback.previous
  const label = previous ? riddleAnswerLabel(previous.riddle, previous.solution) : null
  const rule = previous && previous.riddle.kind !== "maze" ? explainRiddle(previous.riddle, previous.solution) : null
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: 1, x: feedback.tone === "miss" ? [0, -8, 8, -5, 5, 0] : 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs leading-relaxed",
        feedback.tone === "skip"
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-destructive/30 bg-destructive/10 text-foreground/90"
      )}
    >
      {feedback.tone === "skip" ? (
        <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <p className="min-w-0">
        {feedback.line}
        {label && previous && (
          <>
            {" "}
            It was <AnswerToken riddle={previous.riddle} solution={previous.solution} />
            {rule ? `: ${rule.charAt(0).toLowerCase()}${rule.slice(1)}` : "."}
          </>
        )}
      </p>
    </motion.div>
  )
}

interface RiddleStepProps {
  view: RiddleView
  userId: string | null
  onSolved: (view: RiddleView) => void
}

export function RiddleStep({ view, userId, onSolved }: RiddleStepProps) {
  const solve = useSolveRiddle(userId)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const prompt = RIDDLE_PROMPTS[view.riddle.kind]
  const intro = seededPick(RIDDLE_INTROS, view.day)
  const pending = solve.isPending
  const { day, number } = view
  const { mutate } = solve
  const questionId = useId()

  const answer = useCallback(
    (given: RiddleAnswer) => {
      mutate(
        { number, answer: given },
        {
          onSuccess: (result) => {
            if (result.outcome === "correct" || result.outcome === "already_solved") {
              onSolved(result.view)
            } else if (result.outcome === "wrong" || result.outcome === "skipped") {
              const lines = result.outcome === "wrong" ? RIDDLE_MISS_LINES : RIDDLE_SKIP_LINES
              setFeedback({
                tone: result.outcome === "wrong" ? "miss" : "skip",
                line: seededPick(lines, `${day}:${number}`),
                previous: result.previous,
              })
            } else {
              setFeedback(null)
            }
          },
          onError: (error) => setFeedback({ tone: "error", line: error.message, previous: null }),
        }
      )
    },
    [mutate, number, day, onSolved]
  )

  const puzzleKey = `${view.day}:${view.number}`

  return (
    <div className="space-y-4">
      <DialogHeader className="gap-1.5 pr-8">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-hextech)] uppercase">
          <BrainIcon className="size-3.5" aria-hidden />
          {RIDDLE_COPY.kicker}
        </p>
        <div className="flex items-center gap-2">
          <DialogTitle className="font-display text-xl leading-tight text-[var(--color-gold)]">{prompt.title}</DialogTitle>
          <InfoTip help={RIDDLE_HELP} side="bottom" align="start" />
        </div>
        <DialogDescription className="text-xs leading-relaxed">
          {prompt.lore}
          {view.number === 1 && ` ${intro}`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Riddle <span className="font-semibold text-foreground">{view.number}</span> of {view.limit}
        </span>
        <BonusChip bonus={view.bonus} />
      </div>

      {feedback && <FeedbackCard key={`${puzzleKey}:${feedback.tone}`} feedback={feedback} />}

      <section aria-labelledby={questionId} className="space-y-3">
        <p id={questionId} className="text-center font-display text-base text-[var(--color-gold-light)]">
          {prompt.question}
        </p>
        <motion.div
          key={puzzleKey}
          initial={view.number > 1 ? { opacity: 0, x: 28 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {view.riddle.kind === "sequence" ? (
            <SequencePuzzle puzzle={view.riddle.puzzle} pending={pending} onAnswer={answer} />
          ) : view.riddle.kind === "arrows" ? (
            <ArrowPuzzle puzzle={view.riddle.puzzle} pending={pending} onAnswer={answer} />
          ) : (
            <MazePuzzle puzzle={view.riddle.puzzle} pending={pending} onAnswer={answer} />
          )}
        </motion.div>
      </section>

      {view.number < view.limit && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={pending}
            onClick={() => answer({ skip: true })}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 focus-visible:outline-none disabled:opacity-50"
          >
            <RefreshCwIcon className="size-3.5" aria-hidden />
            {RIDDLE_COPY.skip}
            <span className="text-muted-foreground/70">
              ({RIDDLE_COPY.skipNote}
              {view.bonus > 0 ? `, -${RIDDLE_FIRST_TRY_BONUS}` : ""})
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
