import type { LiveTone } from "@/lib/live/tone"

type AudioContextCtor = typeof AudioContext

let audio: AudioContext | null = null

function audioCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

// Browsers only start audio after a user gesture: call this from a click/keydown handler.
export function primeAudio(): void {
  const Ctor = audioCtor()
  if (!Ctor) return
  try {
    audio ??= new Ctor()
    if (audio.state === "suspended") void audio.resume()
  } catch {
    audio = null
  }
}

const NOTES: Record<LiveTone, number[]> = {
  info: [784],
  hype: [659.25, 987.77],
  royal: [523.25, 659.25, 783.99],
  roast: [587.33, 466.16],
  danger: [440, 349.23],
}

export function playChime(tone: LiveTone): void {
  if (!audio || audio.state !== "running") return
  const start = audio.currentTime + 0.01
  NOTES[tone].forEach((frequency, i) => {
    if (!audio) return
    const at = start + i * 0.1
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = "triangle"
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.07, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38)
    osc.connect(gain).connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.4)
  })
}

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

export function buzz(tone: LiveTone): boolean {
  if (!canVibrate()) return false
  try {
    return navigator.vibrate(tone === "danger" ? [90, 60, 90, 60, 90] : tone === "hype" ? [60, 40, 120] : [70])
  } catch {
    return false
  }
}
