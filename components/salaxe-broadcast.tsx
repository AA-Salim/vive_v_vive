"use client"

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useQueryClient } from "@tanstack/react-query"
import { BellOffIcon, RadioTowerIcon, XIcon } from "lucide-react"
import {
  GAP_MS,
  RETRY_MS,
  SHOW_MS,
  between,
  cooldownLeft,
  freshLines,
  isMuted,
  markShown,
  muteUntilTomorrow,
  nextDelay,
} from "@/components/lore/broadcast-schedule"
import { LoreText } from "@/components/lore/lore-text"
import { bottomDockStyle, useVisibleBox } from "@/components/lore/use-visible-viewport"
import { useAct } from "@/hooks/use-act"
import { chronicleQuery, useChronicleSync } from "@/hooks/use-chronicle"
import { getLivePrefs } from "@/hooks/use-live-prefs"
import { useSession } from "@/hooks/use-session"
import { getActContent } from "@/lib/act-content"
import { TIMED_STATUSES } from "@/lib/live/events"
import { randomPick } from "@/lib/lore/seed"
import type { LoreSegment } from "@/lib/lore/segments"
import { cn } from "@/lib/utils"

const DATA_SHARE = 0.4

interface Broadcast {
  id: number
  text: string
  segments: LoreSegment[] | null
  intel: boolean
}

export function SalaxeBroadcast() {
  const { act } = useAct()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion() ?? false
  const box = useVisibleBox()
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const control = useRef<{ pause: () => void; resume: () => void } | null>(null)
  useChronicleSync()

  const content = getActContent(act?.act_number ?? 2)
  const hide = useCallback(() => setBroadcast(null), [])

  const blocked = useEffectEvent(() => {
    const now = Date.now()
    return (
      document.visibilityState !== "visible" ||
      (!!session && TIMED_STATUSES.includes(session.status)) ||
      getLivePrefs().quiet ||
      isMuted(now) ||
      !!document.querySelector('[role="dialog"], [role="alertdialog"]')
    )
  })

  const compose = useEffectEvent(async (): Promise<Broadcast> => {
    const id = Date.now()
    if (Math.random() < DATA_SHARE) {
      const chronicle = await queryClient.fetchQuery(chronicleQuery).catch(() => null)
      const facts = chronicle ? freshLines(chronicle.gazette, (f) => f.text) : []
      if (facts.length > 0) {
        const fact = randomPick(facts)
        return { id, text: fact.text, segments: fact.segments, intel: true }
      }
    }
    const text = randomPick(freshLines(content.broadcasts, (line) => line))
    return { id, text, segments: null, intel: false }
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const attempt = async () => {
      const cooldown = cooldownLeft(Date.now())
      if (cooldown > 0 || blocked()) {
        timer = setTimeout(attempt, Math.max(cooldown, RETRY_MS))
        return
      }
      const next = await compose()
      if (cancelled) return
      if (blocked()) {
        timer = setTimeout(attempt, RETRY_MS)
        return
      }
      markShown(Date.now(), next.text)
      setBroadcast(next)
      timer = setTimeout(attempt, between(GAP_MS))
    }
    timer = setTimeout(attempt, nextDelay(Date.now()))
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!broadcast) return
    const el = barRef.current
    const animation =
      el && typeof el.animate === "function"
        ? el.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: SHOW_MS, easing: "linear", fill: "forwards" })
        : null
    let remaining = SHOW_MS
    let startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(hide, remaining)
    control.current = {
      pause: () => {
        if (!timer) return
        clearTimeout(timer)
        timer = null
        remaining -= Date.now() - startedAt
        animation?.pause()
      },
      resume: () => {
        if (timer) return
        startedAt = Date.now()
        timer = setTimeout(hide, Math.max(remaining, 1_500))
        animation?.play()
      },
    }
    return () => {
      if (timer) clearTimeout(timer)
      animation?.cancel()
      control.current = null
    }
  }, [broadcast, hide])

  const mute = () => {
    muteUntilTomorrow(Date.now())
    hide()
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[23rem]"
      style={bottomDockStyle(box, 368)}
    >
      <AnimatePresence>
        {broadcast && (
          <motion.aside
            key={broadcast.id}
            role="status"
            aria-live="polite"
            aria-label={content.broadcastLabel}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onPointerEnter={() => control.current?.pause()}
            onPointerLeave={() => control.current?.resume()}
            onFocus={() => control.current?.pause()}
            onBlur={() => control.current?.resume()}
            className="pointer-events-auto relative overflow-hidden rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] shadow-2xl shadow-black/50"
          >
            <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-[var(--color-gold)] to-[var(--color-gold-dark)]" />
            <div className="flex items-start gap-3 py-3 pr-12 pl-4">
              <span className="relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/10 ring-1 ring-[var(--color-gold)]/30">
                <RadioTowerIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full ring-1 ring-[var(--color-gold)]/40"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 1.6, repeat: 2, ease: "easeOut" }}
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)]/80 uppercase">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-red-team)]" />
                  {broadcast.intel ? "Intelligence from exile" : content.broadcastLabel}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm leading-snug text-pretty break-words text-[var(--color-gold-light)]",
                    !broadcast.intel && "font-display"
                  )}
                >
                  {broadcast.segments ? <LoreText segments={broadcast.segments} /> : broadcast.text}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-muted-foreground italic">{content.broadcastSignature}</span>
                  <button
                    type="button"
                    onClick={mute}
                    className="-my-2.5 inline-flex h-10 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <BellOffIcon className="size-3.5" aria-hidden />
                    Mute for today
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={hide}
              aria-label="Dismiss broadcast"
              className="absolute top-1.5 right-1.5 grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/5" aria-hidden>
              <div ref={barRef} className="h-full origin-left bg-[var(--color-gold)]/70" />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
