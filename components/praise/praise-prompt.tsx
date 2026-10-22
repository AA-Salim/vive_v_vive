"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CrownIcon, XIcon } from "lucide-react"
import { useActIntroPending } from "@/components/act-intro-modal"
import { ComposerDialog } from "@/components/praise/composer-dialog"
import { Button } from "@/components/ui/button"
import { useAuthUser } from "@/hooks/use-auth"
import { usePraiseState } from "@/hooks/use-praise"
import { useSession } from "@/hooks/use-session"
import { TIMED_STATUSES } from "@/lib/live/events"
import { PRAISE_REWARD } from "@/lib/praise/rules"

const SHOW_AFTER_MS = 75_000
const MUTE_MS = 7 * 24 * 60 * 60 * 1000
const MUTE_KEY = "vvv:praise-prompt-muted-until"
const seenKey = (day: string) => `vvv:praise-prompt:${day}`

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

const isMuted = () => Number(readStorage(MUTE_KEY) ?? 0) > Date.now()

// A once-a-day nudge to sing for Salaxe: only when the praise is available and not sung yet, never during a
// timed game phase, never over another dialog or broadcast, and silenced for a week on request.
export function PraisePrompt() {
  const { user } = useAuthUser()
  const userId = user?.id ?? null
  const praise = usePraiseState(userId, !!userId)
  const { session } = useSession()
  const introPending = useActIntroPending()
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [composer, setComposer] = useState<{ seed: number; open: boolean } | null>(null)

  const state = praise.data?.state
  const ready = !!state?.available && !!state.me?.canSing
  const today = state?.available ? state.today : null
  const reward = state?.available ? state.reward : PRAISE_REWARD
  const gameBusy = !!session && TIMED_STATUSES.includes(session.status)

  useEffect(() => {
    if (!ready || !today || gameBusy || introPending) return
    if (readStorage(seenKey(today)) || isMuted()) return
    const timer = setTimeout(() => {
      const busyScreen = document.querySelector('[role="dialog"], [aria-label="Dismiss broadcast"]')
      if (busyScreen) return
      writeStorage(seenKey(today), "1")
      setVisible(true)
    }, SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [ready, today, gameBusy, introPending])

  const show = visible && ready && !gameBusy

  const openComposer = () => {
    setVisible(false)
    setComposer({ seed: Math.floor(Math.random() * 1_000_000), open: true })
  }

  const mute = () => {
    writeStorage(MUTE_KEY, String(Date.now() + MUTE_MS))
    setVisible(false)
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.aside
            key="praise-prompt"
            role="status"
            aria-label="Sing for Salaxe"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-3 bottom-[calc(var(--app-tabbar-height,0px)+env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-xl border border-[var(--color-gold)]/35 bg-[var(--color-navy-light)] p-4 shadow-2xl shadow-black/50 lg:inset-x-auto lg:bottom-6 lg:left-6 lg:w-[22rem]"
          >
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Close"
              className="absolute top-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 focus-visible:outline-none"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
                <CrownIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="font-display text-base text-[var(--color-gold-light)]">Salaxe awaits his song</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  One written praise a day pays +{reward}. The exiled King is pretending not to check his inbox.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="royal" className="h-10 flex-1" onClick={openComposer}>
                Sing (+{reward})
              </Button>
              <Button variant="ghost" className="h-10" onClick={() => setVisible(false)}>
                Not today
              </Button>
            </div>
            <button
              type="button"
              onClick={mute}
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Stop reminding me for a week
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
      {composer && (
        <ComposerDialog
          key={composer.seed}
          open={composer.open}
          onOpenChange={(open) => setComposer((current) => (current ? { ...current, open } : current))}
          seed={composer.seed}
          userId={userId}
          onOpenHall={() => setComposer(null)}
        />
      )}
    </>
  )
}
