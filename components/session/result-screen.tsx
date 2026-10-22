"use client"

import { useEffect, useState } from "react"
import confetti from "canvas-confetti"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRightIcon, CoinsIcon, CrownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { ChampionAvatar } from "@/components/session/champion-avatar"
import { PhaseStepper } from "@/components/session/phase-stepper"
import { byLane } from "@/components/session/board-types"
import { useServerNow } from "@/components/session/use-clock"
import { SIDE_NAME, relativeTime, victoryLine } from "@/components/session/copy"
import { GAME_POINTS_LINE, RESULT_POINTS_HELP } from "@/components/session/help"
import { PlayerName } from "@/components/titles/player-name"
import { TitlePayout } from "@/components/titles/title-payout"
import { useAuthUser } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { winnerOf } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ProfileTrigger } from "@/components/profile/profile-provider"

// canvas-confetti only understands hex colors.
function cssColor(name: string): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null
}

function celebrate(side: Side) {
  const colors = [side === "blue" ? "--color-blue-team" : "--color-red-team", "--color-gold", "--color-gold-light"]
    .map(cssColor)
    .filter((c): c is string => !!c)
  const base = { disableForReducedMotion: true, colors: colors.length ? colors : undefined, zIndex: 60 }
  confetti({ ...base, particleCount: 90, spread: 70, startVelocity: 48, origin: { x: 0.15, y: 0.75 }, angle: 60 })
  confetti({ ...base, particleCount: 90, spread: 70, startVelocity: 48, origin: { x: 0.85, y: 0.75 }, angle: 120 })
  setTimeout(() => confetti({ ...base, particleCount: 120, spread: 110, startVelocity: 35, origin: { x: 0.5, y: 0.35 } }), 350)
}

const CELEBRATION_WINDOW_MS = 5 * 60_000

const FLASH: Record<Side, string> = {
  blue: "bg-[var(--color-blue-team)]",
  red: "bg-[var(--color-red-team)]",
}

interface ResultScreenProps {
  session: RoomSession
  serverTimeDelta: number
  onDismiss: () => void
}

export function ResultScreen({ session, serverTimeDelta, onDismiss }: ResultScreenProps) {
  const winner = winnerOf(session.status)
  const reduced = useReducedMotion()
  const serverNow = useServerNow(serverTimeDelta, 5_000)
  const { user } = useAuthUser()
  const { byPlayerId } = useEquippedTitles()
  const [flash, setFlash] = useState<Side | null>(null)
  const endedAt = Date.parse(session.updated_at)

  // Celebrate once per tab, and only for a result that just landed: late visitors get the calm version.
  useEffect(() => {
    if (!winner || Date.now() - serverTimeDelta - endedAt > CELEBRATION_WINDOW_MS) return
    const key = `vvv:celebrated:${session.id}`
    try {
      if (window.sessionStorage.getItem(key)) return
    } catch {}
    const frame = requestAnimationFrame(() => {
      try {
        window.sessionStorage.setItem(key, "1")
      } catch {}
      setFlash(winner)
      celebrate(winner)
    })
    return () => cancelAnimationFrame(frame)
  }, [session.id, winner, serverTimeDelta, endedAt])

  useEffect(() => {
    if (!flash) return
    const clear = setTimeout(() => setFlash(null), 1200)
    return () => clearTimeout(clear)
  }, [flash])

  if (!winner) return null

  const winners = session.session_assignments.filter((a) => a.side === winner).sort(byLane)
  const sideText = winner === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"

  return (
    <>
      <AnimatePresence>
        {flash && !reduced && (
          <motion.div
            key="flash"
            aria-hidden
            className={cn("pointer-events-none fixed inset-0 z-50", FLASH[flash])}
            initial={{ opacity: 0.32 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      <motion.section
        aria-labelledby="result-title"
        initial={reduced ? false : { opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl shadow-black/50",
          winner === "blue" ? "border-[var(--color-blue-team)]/60" : "border-[var(--color-red-team)]/60"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            winner === "blue"
              ? "bg-[radial-gradient(ellipse_at_top,var(--color-blue-team)_0%,transparent_65%)]"
              : "bg-[radial-gradient(ellipse_at_top,var(--color-red-team)_0%,transparent_65%)]",
            "opacity-25"
          )}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)] to-transparent" />
        <div className="relative flex flex-col items-center gap-5 px-4 py-6 text-center sm:px-8 sm:py-8">
          <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <PhaseStepper phase="result" coachMode={session.game_mode === "coach_draft"} />
            </div>
          <motion.span
            initial={reduced ? false : { rotate: -18, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }}
            className="flex size-14 items-center justify-center rounded-full border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold)] shadow-[0_0_40px_-6px_var(--color-gold)]"
          >
            <CrownIcon className="size-7" aria-hidden />
          </motion.span>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-gold)]">Victory</p>
            <h1 id="result-title" className={cn("font-display text-4xl leading-none font-bold sm:text-6xl", sideText)}>
              {SIDE_NAME[winner]} wins
            </h1>
            <p className="mx-auto max-w-lg text-sm text-[var(--color-gold-light)]/85 sm:text-base">{victoryLine(session.id)}</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-1 sm:gap-4" aria-label={`${SIDE_NAME[winner]} roster`}>
            {winners.map((a, i) => (
              <motion.li
                key={a.id}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07 }}
                className="flex w-[58px] flex-col items-center gap-1.5 sm:w-20"
              >
                <ProfileTrigger playerId={a.player_id} name={a.players.name} className="rounded-full">
                  <ChampionAvatar assignment={a} size={48} rounded="full" className="ring-[3px]" />
                </ProfileTrigger>
                <PlayerName
                  name={a.players.name}
                  title={byPlayerId.get(a.player_id) ?? null}
                  className="w-full justify-center text-xs font-semibold text-foreground"
                />
                <span className="-mt-1 w-full truncate text-[10px] text-muted-foreground">{a.champion}</span>
              </motion.li>
            ))}
          </ul>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/10 py-1 pr-1 pl-3 text-xs font-medium text-[var(--color-gold-light)]">
            <CoinsIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
            {GAME_POINTS_LINE}
            <InfoTip help={RESULT_POINTS_HELP} />
          </p>
          <TitlePayout
            sessionId={session.id}
            userId={user?.id ?? null}
            sinceResultMs={serverNow !== null && !Number.isNaN(endedAt) ? serverNow - endedAt : null}
          />
          <p className="text-xs text-muted-foreground">
            {session.resolver ? `Declared by ${session.resolver.name}` : "Result recorded"}
            {serverNow !== null && !Number.isNaN(endedAt) ? ` · ${relativeTime(endedAt, serverNow)}` : ""}
          </p>
          <Button className="h-11 px-5 font-semibold" onClick={onDismiss}>
            Back to the lobby
            <ArrowRightIcon aria-hidden />
          </Button>
        </div>
      </motion.section>
    </>
  )
}
