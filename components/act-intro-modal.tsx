"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeftIcon, ArrowRightIcon, CrownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVisibleViewport } from "@/components/lore/use-visible-viewport"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useAct } from "@/hooks/use-act"
import { useSession } from "@/hooks/use-session"
import { TIMED_STATUSES } from "@/lib/live/events"
import { ACT_INTRO_CLOSED_EVENT, actIntroSeenKey, storyForAct, type ActStory } from "@/lib/lore/acts"
import { cn } from "@/lib/utils"

const OPEN_DELAY_MS = 900

function hasSeen(actNumber: number): boolean {
  try {
    return window.localStorage.getItem(actIntroSeenKey(actNumber)) !== null
  } catch {
    return true
  }
}

function markSeen(actNumber: number): void {
  try {
    window.localStorage.setItem(actIntroSeenKey(actNumber), "true")
  } catch {
    return
  }
}

function subscribeIntro(onChange: () => void) {
  window.addEventListener(ACT_INTRO_CLOSED_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(ACT_INTRO_CLOSED_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

// True while this act's story still has to be told: other ceremonies wait for it instead of stacking dialogs.
export function useActIntroPending(): boolean {
  const { act } = useAct()
  const story = storyForAct(act?.act_number)
  return useSyncExternalStore(
    subscribeIntro,
    () => !!story && !hasSeen(story.act),
    () => false
  )
}

export function ActIntroModal() {
  const { act } = useAct()
  const { session, isLoading: sessionLoading } = useSession()
  const story = storyForAct(act?.act_number)
  const pending = useActIntroPending()
  const busy = sessionLoading || (!!session && TIMED_STATUSES.includes(session.status))
  const [open, setOpen] = useState(false)
  const pinned = useVisibleViewport(576)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pending || busy || open) return
    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [pending, busy, open])

  if (!story) return null

  const close = () => {
    markSeen(story.act)
    setOpen(false)
    window.dispatchEvent(new Event(ACT_INTRO_CLOSED_EVENT))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={primaryRef}
        style={pinned}
        className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-0 shadow-2xl shadow-black/60 sm:max-w-xl"
      >
        <StoryPager story={story} onClose={close} primaryRef={primaryRef} />
      </DialogContent>
    </Dialog>
  )
}

interface StoryPagerProps {
  story: ActStory
  onClose: () => void
  primaryRef: RefObject<HTMLButtonElement | null>
}

function StoryPager({ story, onClose, primaryRef }: StoryPagerProps) {
  const reduceMotion = useReducedMotion() ?? false
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const total = story.chapters.length + 1
  const last = step === total - 1
  const chapter = story.chapters[step] ?? null

  const go = (target: number) => {
    const next = Math.min(Math.max(target, 0), total - 1)
    if (next === step) return
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  // preventDefault: on phones the page behind is wider than the screen and would scroll sideways.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    event.preventDefault()
    go(event.key === "ArrowRight" ? step + 1 : step - 1)
  }

  const offset = reduceMotion ? 0 : 28

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] max-w-[160%] -translate-x-1/2 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 pt-3 pr-2 pl-5 sm:pl-7">
        <p className="min-w-0 truncate text-[11px] font-semibold tracking-[0.22em] text-[var(--color-gold)]/80 uppercase">
          {story.kicker}
        </p>
        <Button variant="ghost" className="h-10 shrink-0 px-3 text-muted-foreground" onClick={onClose} aria-label="Skip the story">
          Skip
        </Button>
      </div>

      <div className="relative px-5 sm:px-7">
        <DialogTitle className="font-display text-2xl leading-tight font-semibold text-[var(--color-gold-light)] sm:text-3xl">
          {story.title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          The story so far, in {story.chapters.length} short chapters. Use Next or the arrow keys to read on.
        </DialogDescription>
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                i <= step ? "bg-[var(--color-gold)]" : "bg-[var(--color-gold)]/15"
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative min-h-[15rem] flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-6 sm:min-h-[17rem] sm:px-7" aria-live="polite">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ opacity: 0, x: dir * offset }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => ({ opacity: 0, x: dir * -offset }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: "easeOut" }}
            aria-label={chapter ? `Chapter ${chapter.numeral}: ${chapter.title}` : "Epilogue"}
          >
            {chapter ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span aria-hidden className="font-display text-4xl leading-none text-[var(--color-gold)]/35">
                    {chapter.numeral}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-[var(--color-gold)]">{chapter.title}</h3>
                </div>
                <motion.p
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.18 }}
                  className="mt-4 text-[15px] leading-relaxed text-pretty break-words text-[var(--color-gold-light)]/85 sm:text-base"
                >
                  {chapter.body}
                </motion.p>
              </>
            ) : (
              <div className="flex flex-col items-center py-2 text-center">
                <motion.span
                  initial={reduceMotion ? false : { y: -36, rotate: 0, opacity: 0 }}
                  animate={{ y: 0, rotate: -18, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 13, delay: 0.1 }}
                  className="grid size-16 place-items-center rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10"
                >
                  <CrownIcon className="size-8 text-[var(--color-gold)]" aria-hidden />
                </motion.span>
                <p className="mt-5 font-display text-lg leading-snug text-pretty text-[var(--color-gold-light)] sm:text-xl">
                  {story.closing}
                </p>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="relative flex items-center gap-3 border-t border-[var(--color-gold)]/15 bg-[var(--color-navy-light)]/70 px-4 py-3 sm:px-7">
        <Button
          variant="ghost"
          className={cn("h-11 shrink-0 px-3", step === 0 && "opacity-40")}
          aria-disabled={step === 0}
          onClick={() => go(step - 1)}
          aria-label="Previous chapter"
        >
          <ArrowLeftIcon aria-hidden />
          <span className="hidden sm:inline">Back</span>
        </Button>
        {!last && (
          <span className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
            Chapter {step + 1} of {story.chapters.length}
          </span>
        )}
        <Button
          ref={primaryRef}
          className={cn(
            "h-11 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]",
            last ? "flex-1" : "shrink-0 px-5"
          )}
          onClick={last ? onClose : () => go(step + 1)}
        >
          {last ? story.dismiss : "Next"}
          {!last && <ArrowRightIcon aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
