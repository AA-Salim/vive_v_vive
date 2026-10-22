"use client"

import confetti from "canvas-confetti"
import { useLiveSignal } from "@/components/live/live-context"
import { useAuthUser } from "@/hooks/use-auth"
import type { LiveEventPayloads } from "@/lib/live/events"

const CELEBRATED_PREFIX = "vvv-bounty-celebrated-"

function themeColor(name: string): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null
}

function claimOnce(eventId: string): boolean {
  try {
    const key = CELEBRATED_PREFIX + eventId
    if (window.sessionStorage.getItem(key)) return false
    window.sessionStorage.setItem(key, "1")
    return true
  } catch {
    return true
  }
}

function fireBountyConfetti() {
  const colors = [themeColor("--color-gold"), themeColor("--color-gold-light"), themeColor("--color-red-team")].filter(
    (c): c is string => !!c
  )
  const base = { disableForReducedMotion: true, zIndex: 70, ticks: 200, ...(colors.length ? { colors } : {}) }
  confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.7 } })
  window.setTimeout(() => confetti({ ...base, particleCount: 40, spread: 100, scalar: 0.8, origin: { y: 0.6 } }), 240)
}

// Showers the hunters when a warrant they helped collect pays out. Renders nothing; safe to mount anywhere.
export function BountyCelebration() {
  const { user } = useAuthUser()
  const userId = user?.id ?? null
  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !userId || signal.event.type !== "bounty.claimed") return
    const data = signal.event.data as LiveEventPayloads["bounty.claimed"]
    if (!Array.isArray(data.hunterUserIds) || !data.hunterUserIds.includes(userId)) return
    if (claimOnce(signal.event.id)) fireBountyConfetti()
  })
  return null
}
