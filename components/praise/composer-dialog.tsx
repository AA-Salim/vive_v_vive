"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { COMPOSE_HELP } from "@/components/praise/help"
import { PraiseComposer } from "@/components/praise/praise-composer"
import { PraiseSuccess } from "@/components/praise/praise-success"
import { usePraiseTerms } from "@/components/praise/title-bonus"
import { RiddleLocked, RiddleSolved } from "@/components/praise/riddle/riddle-outcome"
import { RiddleStep } from "@/components/praise/riddle/riddle-step"
import { RitualSteps } from "@/components/praise/riddle/ritual-steps"
import { praiseKeys, usePraiseRules, useRiddle, useSubmitPraise } from "@/hooks/use-praise"
import { normalizePraise } from "@/lib/praise/rules"
import type { HallPage, RiddleView, SubmitResult } from "@/lib/praise/types"
import { COMPOSER_INTROS, COPY, RIDDLE_COPY, seededPick } from "@/lib/praise/voice"

interface ComposerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed: number
  userId: string | null
  onOpenHall: () => void
}

type Phase = "done" | "loading" | "riddle" | "solved" | "locked" | "praise"

// The hand kiss: step 1 solves today's King's Riddle, step 2 writes the praise. Without the riddle migration
// (or when the riddle cannot load) the composer opens directly and the server stays the judge.
export function ComposerDialog({ open, onOpenChange, seed, userId, onOpenHall }: ComposerDialogProps) {
  const queryClient = useQueryClient()
  const submit = useSubmitPraise(userId)
  const riddleQuery = useRiddle(userId, open)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justSolved, setJustSolved] = useState<RiddleView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const rules = usePraiseRules(userId)
  const terms = usePraiseTerms(rules.reward)
  const stageRef = useRef<HTMLDivElement>(null)
  const intro = seededPick(COMPOSER_INTROS, String(seed))

  const riddle = riddleQuery.data?.available ? riddleQuery.data : null
  const phase: Phase = result
    ? "done"
    : riddleQuery.isPending && !!userId
      ? "loading"
      : justSolved
        ? "solved"
        : riddle?.status === "open"
          ? "riddle"
          : riddle?.status === "locked"
            ? "locked"
            : "praise"
  const sharpMind = riddle?.status === "solved" && riddle.firstTry ? riddle.bonus : 0

  const knownFingerprints = useMemo(() => {
    const pages = queryClient.getQueriesData<HallPage>({ queryKey: ["praise", "hall"] })
    return new Set(pages.flatMap(([, page]) => page?.praises.map((p) => normalizePraise(p.body)) ?? []))
  }, [queryClient])

  const lastPhase = useRef(phase)
  useEffect(() => {
    if (lastPhase.current === phase) return
    lastPhase.current = phase
    if (phase === "praise") textareaRef.current?.focus()
    else if (phase !== "done") stageRef.current?.focus()
  }, [phase])

  const handleSubmit = (body: string) => {
    setError(null)
    submit.mutate(body, {
      onSuccess: (data) => setResult(data),
      onError: (failure) => {
        if (failure.code === "already_sung") {
          toast(failure.message)
          onOpenChange(false)
          return
        }
        if (failure.code === "riddle_required") {
          toast(failure.message)
          queryClient.invalidateQueries({ queryKey: praiseKeys.riddle(userId) })
          return
        }
        setError(failure.message)
      },
    })
  }

  let body
  if (phase === "done" && result) {
    body = (
      <PraiseSuccess
        result={result}
        baseReward={rules.reward}
        onClose={() => onOpenChange(false)}
        onOpenHall={() => {
          onOpenChange(false)
          onOpenHall()
        }}
      />
    )
  } else if (phase === "loading") {
    body = (
      <div className="space-y-4" aria-busy="true">
        <RitualSteps step={1} />
        <DialogTitle className="font-display text-xl text-[var(--color-gold)]">{RIDDLE_COPY.stepRiddle}</DialogTitle>
        <p className="text-xs text-muted-foreground">{RIDDLE_COPY.loading}</p>
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    )
  } else if (phase === "riddle" && riddle) {
    body = (
      <>
        <RitualSteps step={1} />
        <RiddleStep view={riddle} userId={userId} onSolved={setJustSolved} />
      </>
    )
  } else if (phase === "solved" && justSolved) {
    body = (
      <>
        <RitualSteps step={2} />
        <RiddleSolved view={justSolved} reward={rules.reward} onContinue={() => setJustSolved(null)} />
      </>
    )
  } else if (phase === "locked" && riddle) {
    body = <RiddleLocked view={riddle} onClose={() => onOpenChange(false)} />
  } else {
    body = (
      <>
        {riddle && <RitualSteps step={2} />}
        <DialogHeader className="gap-1.5 pr-8">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]/80">
            <ScrollTextIcon className="size-3.5" aria-hidden />
            Royal scroll
          </p>
          <div className="flex items-center gap-2">
            <DialogTitle className="font-display text-xl leading-tight text-[var(--color-gold)]">
              {COPY.composerTitle}
            </DialogTitle>
            <InfoTip help={COMPOSE_HELP} side="bottom" align="start" />
          </div>
          <DialogDescription className="text-xs leading-relaxed">
            {intro} One a day, {terms.reward} points
            {sharpMind > 0 && (
              <span className="font-semibold text-[var(--color-gold)]">
                {" "}
                + {sharpMind} {RIDDLE_COPY.sharpMind}
              </span>
            )}
            . He may crown the best one (+{terms.favor}).
          </DialogDescription>
        </DialogHeader>
        <PraiseComposer
          promptSeed={seed}
          rules={rules}
          knownFingerprints={knownFingerprints}
          bonus={sharpMind}
          pending={submit.isPending}
          error={error}
          textareaRef={textareaRef}
          onSubmit={handleSubmit}
          onChange={() => {
            if (error) setError(null)
          }}
        />
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={phase === "praise" ? textareaRef : phase === "done" ? undefined : stageRef}
        className="top-3 max-h-[calc(100dvh-1.5rem)] translate-y-0 gap-5 overflow-y-auto overscroll-contain border border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] p-4 sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:p-6"
      >
        <MotionConfig reducedMotion="user">
          <div ref={stageRef} tabIndex={-1} className="space-y-5 outline-none">
            {body}
          </div>
        </MotionConfig>
      </DialogContent>
    </Dialog>
  )
}
