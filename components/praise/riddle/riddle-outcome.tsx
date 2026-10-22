"use client"

import { motion } from "motion/react"
import { BrainIcon, CheckIcon, FeatherIcon, HourglassIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { PraiseCountdown } from "@/components/praise/praise-countdown"
import { Arrow } from "@/components/praise/riddle/arrow-puzzle"
import { explainRiddle, riddleAnswerLabel } from "@/lib/praise/riddle"
import { PRAISE_REWARD, RIDDLE_FIRST_TRY_BONUS } from "@/lib/praise/rules"
import type { Riddle, RiddleSolution, RiddleView } from "@/lib/praise/types"
import { COPY, RIDDLE_COPY, RIDDLE_CORRECT_LINES, seededPick } from "@/lib/praise/voice"

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315]

function SolvedBurst() {
  return (
    <div className="relative mt-2 flex size-24 items-center justify-center">
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-[var(--color-hextech)]/70"
        initial={{ scale: 0.5, opacity: 1 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {SPARKS.map((angle, index) => (
        <motion.span
          key={angle}
          aria-hidden
          className="absolute size-1.5 rounded-full bg-[var(--color-gold-bright)]"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((angle * Math.PI) / 180) * 58,
            y: Math.sin((angle * Math.PI) / 180) * 58,
            opacity: 0,
            scale: 0.4,
          }}
          transition={{ duration: 0.75, delay: 0.08 + (index % 2) * 0.06, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="relative flex size-20 items-center justify-center rounded-full border border-[var(--color-hextech)]/60 bg-gradient-to-b from-[var(--color-hextech-deep)] to-[var(--color-navy)] shadow-[0_0_32px_-6px_rgb(10_200_185/0.7)]"
        initial={{ scale: 0.3, rotate: -30, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 16 }}
      >
        <BrainIcon className="size-9 text-[var(--color-hextech)]" aria-hidden />
        <motion.span
          className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)] ring-4 ring-[var(--color-navy-light)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 400, damping: 14 }}
        >
          <CheckIcon className="size-4" strokeWidth={3} aria-hidden />
        </motion.span>
      </motion.div>
    </div>
  )
}

// The answer of a retired riddle: the number, or the arrow itself (named for screen readers).
export function AnswerToken({ riddle, solution }: { riddle: Riddle; solution: RiddleSolution | null }) {
  const label = riddleAnswerLabel(riddle, solution)
  if (!label) return null
  if (riddle.kind === "arrows" && solution?.value !== undefined) {
    return (
      <span className="inline-flex translate-y-0.5 items-center rounded border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-0.5 text-[var(--color-gold-light)]">
        <Arrow direction={solution.value} className="size-3.5" />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return <span className="font-semibold text-foreground">{label}</span>
}

function Explanation({ view, lead = "The answer" }: { view: RiddleView; lead?: string }) {
  const rule = explainRiddle(view.riddle, view.solution)
  if (!rule) return null
  const hasToken = !!riddleAnswerLabel(view.riddle, view.solution)
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {hasToken && (
        <>
          {lead}: <AnswerToken riddle={view.riddle} solution={view.solution} />.{" "}
        </>
      )}
      {rule}
    </p>
  )
}

export function RiddleSolved({
  view,
  reward = PRAISE_REWARD,
  onContinue,
}: {
  view: RiddleView
  reward?: number
  onContinue: () => void
}) {
  const line = seededPick(RIDDLE_CORRECT_LINES, `${view.day}:${view.number}`)
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <SolvedBurst />
      <div className="space-y-1">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--color-hextech)] uppercase">Riddle solved</p>
        <DialogTitle className="font-display text-2xl leading-tight text-[var(--color-gold)]">{RIDDLE_COPY.solvedTitle}</DialogTitle>
      </div>
      <DialogDescription className="text-sm text-foreground/90">{line}</DialogDescription>
      <Explanation view={view} />

      {view.firstTry ? (
        <motion.div
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-3.5 py-2.5 text-left"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 260, damping: 20 }}
        >
          <SparklesIcon className="size-5 shrink-0 text-[var(--color-gold)]" aria-hidden />
          <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
            <span className="font-display text-sm text-[var(--color-gold)]">
              {RIDDLE_COPY.sharpMind} +{RIDDLE_FIRST_TRY_BONUS}
            </span>{" "}
            First try. Paid with your praise: +{reward + RIDDLE_FIRST_TRY_BONUS} in total.
          </p>
        </motion.div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Solved on riddle {view.number}. No Sharp Mind bonus for this kiss, the praise still pays +{reward}.
        </p>
      )}

      <Button variant="royal" className="mt-1 h-12 w-full gap-2 text-base" onClick={onContinue}>
        <FeatherIcon aria-hidden />
        {RIDDLE_COPY.next}
      </Button>
    </div>
  )
}

// Every kiss of the day is given: nothing left to riddle until midnight UTC.
export function KissesSpent({ perDay, resetsAt, clockOffset, onClose }: { perDay: number; resetsAt: string | null; clockOffset: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="mt-2 flex size-16 items-center justify-center rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-navy)] text-[var(--color-gold)]">
        <HourglassIcon className="size-7" aria-hidden />
      </span>
      <DialogTitle className="font-display text-xl leading-tight text-[var(--color-gold)]">{RIDDLE_COPY.spentTitle}</DialogTitle>
      <DialogDescription className="text-sm leading-relaxed">
        {COPY.allKissed(perDay)} {COPY.comeBack}
        {resetsAt ? (
          <>
            {" "}
            {COPY.nextSong}{" "}
            <PraiseCountdown target={resetsAt} clockOffset={clockOffset} className="font-semibold tabular-nums text-foreground" />.
          </>
        ) : null}
      </DialogDescription>
      <Button variant="outline" className="mt-1 h-11 w-full" onClick={onClose}>
        Until tomorrow
      </Button>
    </div>
  )
}

export function RiddleLocked({ view, onClose }: { view: RiddleView; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="mt-2 flex size-16 items-center justify-center rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-navy)] text-[var(--color-gold)]">
        <HourglassIcon className="size-7" aria-hidden />
      </span>
      <DialogTitle className="font-display text-xl leading-tight text-[var(--color-gold)]">{RIDDLE_COPY.lockedTitle}</DialogTitle>
      <DialogDescription className="text-sm leading-relaxed">{RIDDLE_COPY.lockedBody}</DialogDescription>
      <Explanation view={view} lead="The last one" />
      <Button variant="outline" className="mt-1 h-11 w-full" onClick={onClose}>
        Until tomorrow
      </Button>
    </div>
  )
}
