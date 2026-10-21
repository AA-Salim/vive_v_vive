"use client"

import { useEffect, useRef } from "react"
import { useLivePrefs } from "@/hooks/use-live-prefs"
import { buzz, playChime } from "@/lib/live/cues"

// Chimes (and buzzes, if the viewer opted in) the moment the clock passes to this coach.
export function useTurnCue(active: boolean) {
  const [prefs] = useLivePrefs()
  const previous = useRef<boolean | null>(null)
  useEffect(() => {
    const was = previous.current
    previous.current = active
    if (was !== false || !active) return
    if (prefs.sound) playChime("royal")
    if (prefs.vibrate) buzz("hype")
  }, [active, prefs.sound, prefs.vibrate])
}
