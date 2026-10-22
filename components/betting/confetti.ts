"use client"

import confetti from "canvas-confetti"
import type { Side } from "@/lib/types"

function themeColor(name: string): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null
}

export function fireWinConfetti(side: Side | null) {
  if (typeof window === "undefined") return
  const colors = [
    themeColor("--color-gold"),
    themeColor("--color-gold-light"),
    side ? themeColor(side === "blue" ? "--color-blue-team" : "--color-red-team") : null,
  ].filter((c): c is string => !!c)
  const base = { disableForReducedMotion: true, zIndex: 70, ticks: 220, ...(colors.length ? { colors } : {}) }
  confetti({ ...base, particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.65 } })
  window.setTimeout(() => confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } }), 220)
  window.setTimeout(() => confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } }), 380)
}

const CELEBRATED_PREFIX = "vvv-bet-celebrated-"

// One celebration per session per browser tab, whichever surface (panel or dialog) shows it first.
export function claimCelebration(sessionId: string): boolean {
  try {
    const key = CELEBRATED_PREFIX + sessionId
    // The match room's result screen already threw confetti for this game in this tab.
    if (window.sessionStorage.getItem(key) || window.sessionStorage.getItem(`vvv:celebrated:${sessionId}`)) return false
    window.sessionStorage.setItem(key, "1")
    return true
  } catch {
    return false
  }
}
