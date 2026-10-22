"use client"

import { useEffect, useMemo } from "react"
import confetti from "canvas-confetti"
import { MotionConfig, motion } from "motion/react"
import { CrownIcon, HandHeartIcon, HourglassIcon, LibraryIcon, SparklesIcon, TimerIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { AnimatedNumber } from "@/components/praise/animated-number"
import { PraiseCountdown } from "@/components/praise/praise-countdown"
import { submittedEffectLines, usePraiseTerms } from "@/components/praise/title-bonus"
import { formatSolve } from "@/lib/praise/format"
import type { SubmitResult } from "@/lib/praise/types"
import { COPY, RIDDLE_COPY, sungResponse } from "@/lib/praise/voice"

function themeColors(): string[] | undefined {
  const styles = getComputedStyle(document.documentElement)
  const colors = ["--color-gold", "--color-gold-light", "--color-gold-dark"]
    .map((name) => styles.getPropertyValue(name).trim())
    .filter(Boolean)
  return colors.length ? colors : undefined
}

function celebrate() {
  const colors = themeColors()
  const base = { colors, disableForReducedMotion: true, zIndex: 70, ticks: 160 }
  confetti({ ...base, particleCount: 70, spread: 75, startVelocity: 42, origin: { x: 0.5, y: 0.3 } })
  setTimeout(() => {
    confetti({ ...base, particleCount: 35, angle: 60, spread: 55, origin: { x: 0, y: 0.55 } })
    confetti({ ...base, particleCount: 35, angle: 120, spread: 55, origin: { x: 1, y: 0.55 } })
  }, 180)
}

interface PraiseSuccessProps {
  result: SubmitResult
  resetsAt: string
  clockOffset: number
  // Starts the next kiss of the day in the same dialog; absent once every kiss is given.
  onKissAgain?: () => void
  onOpenHall: () => void
  onClose: () => void
}

export function PraiseSuccess({ result, resetsAt, clockOffset, onKissAgain, onOpenHall, onClose }: PraiseSuccessProps) {
  const response = useMemo(() => sungResponse(result.praise.body, result.praise.id), [result])
  const reward = result.praise.reward
  const baseReward = result.baseReward
  const effectLines = useMemo(() => submittedEffectLines(result), [result])
  const titleBonus = reward - baseReward
  const bonus = result.riddleBonus ?? 0
  const total = reward + bonus
  const next = usePraiseTerms(result.nextReward ?? baseReward)
  const several = result.perDay > 1
  const solve = formatSolve(result.riddleMs, result.riddleMisses)

  useEffect(() => {
    celebrate()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <motion.div
          className="relative mt-2"
          initial={{ y: -36, scale: 0.4, rotate: -24, opacity: 0 }}
          animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 15 }}
        >
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--color-gold)]/40 blur-xl"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
          <div className="relative flex size-20 items-center justify-center rounded-full border border-[var(--color-gold)]/60 bg-gradient-to-b from-[var(--color-navy-lighter)] to-[var(--color-navy)] shadow-lg shadow-primary/30">
            <CrownIcon className="size-10 text-[var(--color-gold)]" aria-hidden />
          </div>
        </motion.div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-gold)]/80">
            Praise accepted{several ? ` · kiss ${result.slot} of ${result.perDay}` : ""}
          </p>
          <DialogTitle className="font-display text-2xl leading-tight text-[var(--color-gold)]">
            {COPY.successTitle}
          </DialogTitle>
        </div>

        <div className="space-y-1">
          <AnimatedNumber
            value={total}
            from={0}
            prefix="+"
            duration={1.1}
            className="font-display text-5xl font-bold text-[var(--color-gold)]"
          />
          {bonus > 0 && (
            <motion.p
              className="text-xs text-muted-foreground"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              {reward} for the praise{" "}
              <span className="font-semibold text-[var(--color-gold)]">
                + {bonus} {RIDDLE_COPY.sharpMind}
              </span>
            </motion.p>
          )}
          {solve && (
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground tabular-nums">
              <TimerIcon className="size-3.5 text-[var(--color-hextech)]" aria-hidden />
              {solve}
            </p>
          )}
        </div>

        {(titleBonus > 0 || effectLines.length > 0) && (
          <div className="-mt-2 flex max-w-full flex-col items-center gap-1">
            {titleBonus > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-gold-light)]">
                <SparklesIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
                {baseReward} + {titleBonus} from your titles
              </span>
            )}
            {effectLines.map((line) => (
              <span key={line} className="text-[11px] text-muted-foreground">
                {line}
              </span>
            ))}
          </div>
        )}

        <DialogDescription className="text-sm">
          Treasury{" "}
          <AnimatedNumber
            value={result.balance}
            from={result.balance - total}
            duration={1.1}
            className="font-semibold text-foreground"
          />{" "}
          points
        </DialogDescription>

        <motion.figure
          className="w-full rounded-xl border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 px-4 py-3 text-left"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.35 }}
        >
          <blockquote className="font-serif text-[15px] leading-relaxed italic text-foreground/90">
            {"\u201c"}
            {response}
            {"\u201d"}
          </blockquote>
          <figcaption className="mt-2 text-xs text-muted-foreground">Salaxe, from exile</figcaption>
        </motion.figure>

        <p className="text-xs text-muted-foreground">{COPY.successHint}</p>

        {onKissAgain ? (
          <div className="w-full space-y-1">
            <Button variant="royal" className="h-12 w-full gap-2 text-base" onClick={onKissAgain}>
              <HandHeartIcon aria-hidden />
              {COPY.kissAgain(next.reward)}
            </Button>
            <p className="text-[11px] text-muted-foreground">{COPY.leftToday(result.remainingToday)}</p>
          </div>
        ) : several ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-gold)]/5 px-3 py-2 text-xs text-muted-foreground">
            <HourglassIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
            <span>
              {COPY.allKissed(result.perDay)} {COPY.comeBack} {COPY.nextSong}{" "}
              <PraiseCountdown target={resetsAt} clockOffset={clockOffset} className="font-semibold tabular-nums text-foreground" />
            </span>
          </p>
        ) : null}

        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={onOpenHall}>
            <LibraryIcon aria-hidden />
            See the Hall
          </Button>
          <Button variant={onKissAgain ? "outline" : "default"} className="h-11 font-semibold" onClick={onClose}>
            Long live the King
          </Button>
        </div>
      </div>
    </MotionConfig>
  )
}
