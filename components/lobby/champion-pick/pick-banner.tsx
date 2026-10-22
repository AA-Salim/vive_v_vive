"use client"

import { useEffect, useEffectEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CheckCheckIcon, HourglassIcon, SwordsIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { CHAMPION_HELP } from "@/components/lobby/champion-pick/help"
import { useServerNow } from "@/components/session/use-clock"
import { CHAMPION_PICK_GRACE_MS, CHAMPION_PICK_ORDER, CHAMPION_PICK_SECONDS, type ChampionTurn } from "@/lib/lobby/champion-pick"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_NAME: Record<Side, string> = { blue: "Blue", red: "Red" }
const URGENT_MS = 10_000
const MAX_EXPIRY_POKES = 5

function upcoming(pickNumber: number): string {
  const next = CHAMPION_PICK_ORDER.slice(pickNumber, pickNumber + 2)
  if (next.length === 0) return "Last pick of champion select."
  if (next.length === 2 && next[0] === next[1]) return `Then ${SIDE_NAME[next[0]]} picks twice.`
  return `Then ${next.map((s) => SIDE_NAME[s]).join(", then ")}.`
}

interface PickBannerProps {
  turn: ChampionTurn | null
  isMyTurn: boolean
  coachName: (side: Side) => string
  serverTimeDelta: number
  done: boolean
  onExpired: () => void
}

export function PickBanner({ turn, isMyTurn, coachName, serverTimeDelta, done, onExpired }: PickBannerProps) {
  const reduced = useReducedMotion()
  const serverNow = useServerNow(serverTimeDelta, 250, !!turn?.endsAt)
  const endsAt = turn?.endsAt ? Date.parse(turn.endsAt) : null
  const remaining = endsAt !== null && serverNow !== null ? endsAt - serverNow : null
  const expired = remaining !== null && remaining <= -CHAMPION_PICK_GRACE_MS
  const urgent = remaining !== null && remaining <= URGENT_MS
  const seconds = remaining === null ? null : Math.max(0, Math.ceil(remaining / 1000))
  const progress = remaining === null ? 1 : Math.min(1, Math.max(0, remaining / (CHAMPION_PICK_SECONDS * 1000)))

  // The server auto-picks lazily: once the deadline (and its grace) has passed, a read lands the pick.
  const poke = useEffectEvent(() => onExpired())
  const pickNumber = turn?.pickNumber ?? null
  useEffect(() => {
    if (!expired) return
    let attempts = 0
    let timer = setTimeout(function retry() {
      poke()
      attempts += 1
      if (attempts < MAX_EXPIRY_POKES) timer = setTimeout(retry, 1500 + Math.random() * 700)
    }, 100 + Math.random() * 400)
    return () => clearTimeout(timer)
  }, [expired, pickNumber])

  const key = done ? "done" : `${turn?.pickNumber ?? 0}:${isMyTurn}`
  const side = turn?.side ?? null
  const title = done ? "All ten champions locked" : isMyTurn ? "Your pick" : side ? `${coachName(side)} is picking` : "Champion select"
  const line = done
    ? "Opening the draft with the coaches' picks."
    : turn
      ? `${SIDE_NAME[turn.side]} pick ${turn.pickNumber} of 10. ${upcoming(turn.pickNumber)}`
      : "Waiting for the board."
  const Icon = done ? CheckCheckIcon : isMyTurn ? SwordsIcon : HourglassIcon

  return (
    <div aria-live="polite" className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className={cn(
            "relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 sm:px-4",
            done && "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/10",
            !done && side === "blue" && "border-[var(--color-blue-team)]/45 bg-[var(--color-blue-team)]/10",
            !done && side === "red" && "border-[var(--color-red-team)]/45 bg-[var(--color-red-team)]/10",
            isMyTurn && "border-[var(--color-gold)] shadow-[0_0_32px_-8px_var(--color-gold)]"
          )}
        >
          {isMyTurn && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-r from-[var(--color-gold)]/0 via-[var(--color-gold)]/15 to-[var(--color-gold)]/0 motion-safe:animate-pulse"
            />
          )}
          <span
            className={cn(
              "relative flex size-10 shrink-0 items-center justify-center rounded-full",
              isMyTurn ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "bg-muted text-[var(--color-gold)]"
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="relative min-w-0 flex-1">
            <span
              className={cn(
                "block font-display leading-tight font-semibold",
                isMyTurn ? "text-2xl text-[var(--color-gold)] sm:text-3xl" : "truncate text-lg text-foreground sm:text-xl"
              )}
            >
              {title}
            </span>
            <span className="block text-xs text-muted-foreground sm:text-sm">{line}</span>
          </span>
          {!done && seconds !== null && (
            <span className="relative flex shrink-0 flex-col items-end gap-1" role="timer" aria-label={`${seconds} seconds left on this pick`}>
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "font-display text-3xl leading-none font-semibold tabular-nums sm:text-4xl",
                    urgent ? "text-[var(--color-red-team)]" : "text-[var(--color-gold)]",
                    urgent && seconds > 0 && "motion-safe:animate-pulse"
                  )}
                >
                  {seconds}
                </span>
                <InfoTip help={CHAMPION_HELP.timer} align="end" />
              </span>
              <span className="block h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className={cn("block h-full origin-left rounded-full", urgent ? "bg-[var(--color-red-team)]" : "bg-[var(--color-gold)]")}
                  style={{ transform: `scaleX(${progress})` }}
                />
              </span>
              {seconds === 0 && <span className="text-[10px] text-muted-foreground">Auto-picking</span>}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
