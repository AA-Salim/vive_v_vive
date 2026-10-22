"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { BellRingIcon, XIcon } from "lucide-react"
import { useActIntroPending } from "@/components/act-intro-modal"
import { IOS_INSTALL_HINT } from "@/components/live/notify-settings"
import { requestNotifications, useNotifyState } from "@/components/live/notifier"
import { Button } from "@/components/ui/button"
import { useAuthUser } from "@/hooks/use-auth"
import { useLivePrefs } from "@/hooks/use-live-prefs"
import { useSession } from "@/hooks/use-session"
import { TIMED_STATUSES } from "@/lib/live/events"

const SHOW_AFTER_MS = 15_000
const DONE_KEY = "vvv-notify-prompt"
// Shared with the other floating prompts so two never stack in the same corner.
const FLOATING_PROMPT = "[data-floating-prompt]"

function isDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) !== null
  } catch {
    return true
  }
}

function markDone(answer: string) {
  try {
    window.localStorage.setItem(DONE_KEY, answer)
  } catch {}
}

// One friendly ask for the notification permission (browsers only allow it from a tap): shown once, a little
// after arrival, never during a timed phase or over a dialog. On iPhone outside the installed app it explains
// the Home Screen step instead, since Safari tabs cannot notify.
export function NotifyPrompt() {
  const [prefs, setPrefs] = useLivePrefs()
  const state = useNotifyState()
  const signedIn = !!useAuthUser().user
  const { session } = useSession()
  const introPending = useActIntroPending()
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [asking, setAsking] = useState(false)

  const askable = state.permission === "default" || state.needsInstall
  const eligible = prefs.notify && askable
  const gameBusy = !!session && TIMED_STATUSES.includes(session.status)

  useEffect(() => {
    if (!eligible || gameBusy || introPending || visible || isDone()) return
    const timer = setTimeout(() => {
      if (document.visibilityState !== "visible") return
      if (document.querySelector(`[role="dialog"], [aria-label="Dismiss broadcast"], ${FLOATING_PROMPT}`)) return
      setVisible(true)
    }, SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [eligible, gameBusy, introPending, visible])

  const show = visible && eligible && !gameBusy

  const close = (answer: string) => {
    markDone(answer)
    setVisible(false)
  }

  const enable = async () => {
    setAsking(true)
    const permission = await requestNotifications()
    setAsking(false)
    if (permission === "granted") setPrefs({ notify: true })
    close(permission)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="notify-prompt"
          role="status"
          aria-label="Turn on notifications"
          data-floating-prompt=""
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed inset-x-3 bottom-[calc(var(--app-tabbar-height,0px)+env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-xl border border-[var(--color-gold)]/35 bg-[var(--color-navy-light)] p-4 shadow-2xl shadow-black/50 lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[22rem]"
        >
          <button
            type="button"
            onClick={() => close("dismissed")}
            aria-label="Close"
            className="absolute top-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 focus-visible:outline-none"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
              <BellRingIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-display text-base text-[var(--color-gold-light)]">Never miss a game</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {state.needsInstall
                  ? IOS_INSTALL_HINT
                  : signedIn
                    ? "A notification when a game is launched, bets open or the result lands, and when someone comes for you. Even with the app closed."
                    : "A notification when a game is launched, bets open or the result lands. Sign in to also get them with the app closed."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state.needsInstall ? (
              <Button variant="royal" className="h-10 flex-1" onClick={() => close("install")}>
                Got it
              </Button>
            ) : (
              <>
                <Button variant="royal" className="h-10 flex-1" onClick={() => void enable()} disabled={asking}>
                  Turn on notifications
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => close("later")}>
                  Not now
                </Button>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
