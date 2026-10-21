"use client"

import { useEffect, useMemo } from "react"
import confetti from "canvas-confetti"
import { MotionConfig, motion } from "motion/react"
import { CrownIcon, LibraryIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { AnimatedNumber } from "@/components/praise/animated-number"
import type { SubmitResult } from "@/lib/praise/types"
import { COPY, sungResponse } from "@/lib/praise/voice"

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
  onOpenHall: () => void
  onClose: () => void
}

export function PraiseSuccess({ result, onOpenHall, onClose }: PraiseSuccessProps) {
  const response = useMemo(() => sungResponse(result.praise.body, result.praise.id), [result])
  const reward = result.praise.reward

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
            Praise accepted
          </p>
          <DialogTitle className="font-display text-2xl leading-tight text-[var(--color-gold)]">
            {COPY.successTitle}
          </DialogTitle>
        </div>

        <AnimatedNumber
          value={reward}
          from={0}
          prefix="+"
          duration={1.1}
          className="font-display text-5xl font-bold text-[var(--color-gold)]"
        />

        <DialogDescription className="text-sm">
          Treasury{" "}
          <AnimatedNumber
            value={result.balance}
            from={result.balance - reward}
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

        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={onOpenHall}>
            <LibraryIcon aria-hidden />
            See the Hall
          </Button>
          <Button className="h-11 font-semibold" onClick={onClose}>
            Long live the King
          </Button>
        </div>
      </div>
    </MotionConfig>
  )
}
