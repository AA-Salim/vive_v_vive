"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import { getChampionImageUrl } from "@/lib/champions"
import type { RoomSession } from "@/lib/session/types"
import { buildRevealPlan, revealFrame, type RevealFrame } from "@/components/session/reveal"
import { useNow } from "@/components/session/use-clock"

export interface RevealState {
  frame: RevealFrame | null
  revealing: boolean
  skip: () => void
}

export function useReveal(session: RoomSession | null, serverTimeDelta: number): RevealState {
  const reduced = useReducedMotion()
  const [skippedKey, setSkippedKey] = useState<string | null>(null)
  const plan = buildRevealPlan(session)

  const coarse = useNow(500, !!plan)
  const coarseServer = coarse === null ? null : coarse - serverTimeDelta
  const live =
    !!plan && !reduced && skippedKey !== plan.key && (coarseServer === null || coarseServer < plan.start + plan.duration + 500)
  const fine = useNow(50, live)

  let frame: RevealFrame | null = null
  if (plan && live) {
    if (fine === null) frame = revealFrame(plan, 0)
    else {
      const t = fine - serverTimeDelta - plan.start
      if (t < plan.duration) frame = revealFrame(plan, Math.max(0, t))
    }
  }

  const preloadKey = plan && live ? [...plan.finals, ...Object.values(plan.candidates).flat().map((c) => c.internal)].join(",") : ""
  useEffect(() => {
    if (!preloadKey) return
    const images = [...new Set(preloadKey.split(","))].map((internal) => {
      const img = new window.Image()
      img.src = getChampionImageUrl(internal)
      return img
    })
    return () => {
      images.length = 0
    }
  }, [preloadKey])

  return {
    frame,
    revealing: frame !== null,
    skip: () => {
      if (plan) setSkippedKey(plan.key)
    },
  }
}
